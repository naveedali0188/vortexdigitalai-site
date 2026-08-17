"""
VortexDigitalAI — Chatbot backend
----------------------------------
A small Flask API that powers the website's floating chat widget.
Deployed SEPARATELY from GitHub Pages (GitHub Pages only serves static
files — it cannot run this). See backend/README.md for deployment.

Endpoints:
  GET  /api/health   -> simple health check
  POST /api/chat      -> chat completion request

This file intentionally stays thin — all real logic lives in services/.
"""
import os
import time
import logging
from collections import defaultdict, deque

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from services.ai_service import get_ai_response, AIServiceError
from services.catalog_service import CatalogService
from services.tone_service import detect_tone
from services.prompt_service import build_system_prompt

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vortex-chatbot")

# ---------------------------------------------------------------------
# Configuration (env vars only — nothing secret is hardcoded)
# ---------------------------------------------------------------------
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://127.0.0.1:5500"
).split(",") if o.strip()]

MAX_MESSAGE_LENGTH = int(os.environ.get("MAX_MESSAGE_LENGTH", "1000"))
MAX_HISTORY_MESSAGES = int(os.environ.get("MAX_HISTORY_MESSAGES", "10"))
RATE_LIMIT_PER_MINUTE = int(os.environ.get("RATE_LIMIT_PER_MINUTE", "12"))
CHATBOT_ENABLED = os.environ.get("CHATBOT_ENABLED", "true").lower() == "true"

app = Flask(__name__)
CORS(app, origins=ALLOWED_ORIGINS, methods=["POST", "GET", "OPTIONS"])

catalog = CatalogService()

# ---------------------------------------------------------------------
# Very small in-memory rate limiter (per IP). Fine for a single-instance
# free-tier deployment; if you scale to multiple instances, swap this
# for a shared store (see README "Scaling notes").
# ---------------------------------------------------------------------
_request_log = defaultdict(deque)


def _is_rate_limited(ip: str) -> bool:
    now = time.time()
    window = _request_log[ip]
    while window and now - window[0] > 60:
        window.popleft()
    if len(window) >= RATE_LIMIT_PER_MINUTE:
        return True
    window.append(now)
    return False


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "success": True,
        "status": "ok",
        "chatbot_enabled": CHATBOT_ENABLED,
        "model": os.environ.get("MODEL_NAME", "not configured"),
    })


@app.route("/api/chat", methods=["POST"])
def chat():
    if not CHATBOT_ENABLED:
        return jsonify({"success": False, "message": "The chat assistant is currently disabled."}), 503

    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "unknown").split(",")[0].strip()
    if _is_rate_limited(client_ip):
        return jsonify({
            "success": False,
            "message": "You're sending messages a bit fast — please wait a moment and try again."
        }), 429

    body = request.get_json(silent=True) or {}
    message = (body.get("message") or "").strip()
    conversation = body.get("conversation") or []
    current_page_context = body.get("pageContext") or {}

    if not message:
        return jsonify({"success": False, "message": "Please type a message before sending."}), 400

    if len(message) > MAX_MESSAGE_LENGTH:
        return jsonify({
            "success": False,
            "message": f"That message is a bit long — please keep it under {MAX_MESSAGE_LENGTH} characters."
        }), 400

    # Trim history defensively — never trust client-provided length
    if not isinstance(conversation, list):
        conversation = []
    conversation = conversation[-MAX_HISTORY_MESSAGES:]
    sanitized_history = []
    for turn in conversation:
        role = turn.get("role")
        content = turn.get("content")
        if role in ("user", "assistant") and isinstance(content, str):
            sanitized_history.append({"role": role, "content": content[:MAX_MESSAGE_LENGTH]})

    tone = detect_tone(message)

    # Pull relevant services/courses/FAQ context for this specific message
    context_snippets = catalog.search(message)

    system_prompt = build_system_prompt(
        context_snippets=context_snippets,
        tone=tone,
        page_context=current_page_context,
    )

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(sanitized_history)
    messages.append({"role": "user", "content": message})

    try:
        reply = get_ai_response(messages)
    except AIServiceError as e:
        logger.warning("AI service error: %s", e)
        return jsonify({
            "success": False,
            "message": "Sorry, I'm having trouble connecting right now. Please try again in a moment, "
                        "or reach us directly on WhatsApp at +92 312 528 2051."
        }), 502
    except Exception:
        logger.exception("Unexpected error handling chat request")
        return jsonify({
            "success": False,
            "message": "Sorry, something went wrong on my end. Please try again."
        }), 500

    return jsonify({"success": True, "message": reply, "tone": tone})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=os.environ.get("FLASK_DEBUG", "false").lower() == "true")

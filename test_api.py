"""
Tests for the /api/chat and /api/health endpoints.

The real AI call (ai_service.get_ai_response) is always mocked here —
these tests never make a real network call or spend real quota, per the
project requirement to keep CI free.

Run with: pytest
"""
import os
import sys
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from app import app as flask_app, _request_log


@pytest.fixture
def client():
    flask_app.config["TESTING"] = True
    _request_log.clear()
    with flask_app.test_client() as c:
        yield c


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["success"] is True
    assert data["status"] == "ok"


@patch("app.get_ai_response", return_value="Hi! I'd be happy to help.")
def test_valid_chat_request(mock_ai, client):
    resp = client.post("/api/chat", json={"message": "Hello, what services do you offer?"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["success"] is True
    assert "help" in data["message"].lower()
    assert data["tone"] in ["neutral", "positive", "confused", "frustrated", "angry", "urgent"]
    mock_ai.assert_called_once()


def test_empty_message_rejected(client):
    resp = client.post("/api/chat", json={"message": ""})
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["success"] is False


def test_missing_message_field(client):
    resp = client.post("/api/chat", json={})
    assert resp.status_code == 400


def test_extremely_long_message_rejected(client):
    long_message = "a" * 5000
    resp = client.post("/api/chat", json={"message": long_message})
    assert resp.status_code == 400
    assert "long" in resp.get_json()["message"].lower()


@patch("app.get_ai_response", side_effect=Exception("simulated crash"))
def test_ai_service_unexpected_error_is_handled_gracefully(mock_ai, client):
    resp = client.post("/api/chat", json={"message": "Tell me about your courses"})
    assert resp.status_code == 500
    data = resp.get_json()
    assert data["success"] is False
    assert "500" not in data["message"]  # never leak raw errors to the user


@patch("app.get_ai_response")
def test_ai_service_error_returns_friendly_message(mock_ai, client):
    from services.ai_service import AIServiceError
    mock_ai.side_effect = AIServiceError("rate limited")
    resp = client.post("/api/chat", json={"message": "Hi"})
    assert resp.status_code == 502
    data = resp.get_json()
    assert data["success"] is False
    assert "trouble connecting" in data["message"].lower()


@patch("app.get_ai_response", return_value="Sure, here's how PrestaShop migration works...")
def test_product_lookup_context_included(mock_ai, client):
    resp = client.post("/api/chat", json={"message": "Tell me about PrestaShop migration"})
    assert resp.status_code == 200
    # Verify catalog context was actually passed into the system prompt
    called_messages = mock_ai.call_args[0][0]
    system_message = called_messages[0]["content"]
    assert "PrestaShop" in system_message


@patch("app.get_ai_response", return_value="We offer several courses...")
def test_course_recommendation_context_included(mock_ai, client):
    resp = client.post("/api/chat", json={"message": "What courses teach digital marketing?"})
    assert resp.status_code == 200
    called_messages = mock_ai.call_args[0][0]
    system_message = called_messages[0]["content"]
    assert "COURSE" in system_message or "Marketing" in system_message


def test_tone_detection_frustrated():
    from services.tone_service import detect_tone
    assert detect_tone("My order is late and nobody is helping me!!!") in ["frustrated", "urgent", "angry"]


def test_tone_detection_positive():
    from services.tone_service import detect_tone
    assert detect_tone("Thanks so much, this is great!") == "positive"


def test_tone_detection_neutral():
    from services.tone_service import detect_tone
    assert detect_tone("What time do you open?") == "neutral"


@patch("app.get_ai_response", return_value="ok")
def test_conversation_context_passed_through(mock_ai, client):
    conversation = [
        {"role": "user", "content": "Tell me about your AI Financial Analyst course"},
        {"role": "assistant", "content": "It's a 3-month course covering..."},
    ]
    resp = client.post("/api/chat", json={"message": "How long is it?", "conversation": conversation})
    assert resp.status_code == 200
    called_messages = mock_ai.call_args[0][0]
    # system + 2 history turns + new user message
    assert len(called_messages) == 4


def test_rate_limiting(client, monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_PER_MINUTE", "2")
    with patch("app.get_ai_response", return_value="ok"):
        with patch("app.RATE_LIMIT_PER_MINUTE", 2):
            r1 = client.post("/api/chat", json={"message": "hi"})
            r2 = client.post("/api/chat", json={"message": "hi again"})
            r3 = client.post("/api/chat", json={"message": "hi once more"})
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r3.status_code == 429


def test_invalid_json_request(client):
    resp = client.post("/api/chat", data="not json", content_type="application/json")
    assert resp.status_code == 400


def test_chatbot_disabled(client, monkeypatch):
    with patch("app.CHATBOT_ENABLED", False):
        resp = client.post("/api/chat", json={"message": "hi"})
    assert resp.status_code == 503

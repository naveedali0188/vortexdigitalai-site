"""
Calls the GitHub Models inference API.

Docs (verified current as of this writing): https://docs.github.com/en/rest/models/inference
Endpoint: https://models.github.ai/inference/chat/completions
Auth: Bearer token with the `models: read` permission (a fine-grained PAT,
      or a GITHUB_TOKEN from a workflow with `models: read` permission).

The model is fully configurable via the MODEL_NAME env var — nothing is
hardcoded, so you can swap models later without touching code. Check the
live catalog at https://models.github.ai/catalog/models for what's
currently available to your account before picking a MODEL_NAME.
"""
import os
import requests

GITHUB_MODELS_ENDPOINT = "https://models.github.ai/inference/chat/completions"
REQUEST_TIMEOUT_SECONDS = 20


class AIServiceError(Exception):
    """Raised for any failure calling the AI backend — caller shows a friendly message."""


def get_ai_response(messages: list[dict]) -> str:
    token = os.environ.get("GITHUB_TOKEN")
    model = os.environ.get("MODEL_NAME", "openai/gpt-4.1")

    if not token:
        raise AIServiceError("GITHUB_TOKEN is not configured on the server.")

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.4,
        "max_tokens": 500,
    }
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2026-03-10",
    }

    try:
        resp = requests.post(
            GITHUB_MODELS_ENDPOINT,
            json=payload,
            headers=headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except requests.exceptions.Timeout as e:
        raise AIServiceError("Request to GitHub Models timed out.") from e
    except requests.exceptions.RequestException as e:
        raise AIServiceError(f"Network error calling GitHub Models: {e}") from e

    if resp.status_code == 401:
        raise AIServiceError("Authentication failed — check GITHUB_TOKEN and its `models: read` permission.")
    if resp.status_code == 429:
        raise AIServiceError("GitHub Models rate limit / free quota reached.")
    if resp.status_code >= 400:
        raise AIServiceError(f"GitHub Models returned status {resp.status_code}: {resp.text[:300]}")

    try:
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, ValueError) as e:
        raise AIServiceError("Received an empty or malformed response from GitHub Models.") from e

    if not content or not content.strip():
        raise AIServiceError("Empty response from GitHub Models.")

    return content.strip()

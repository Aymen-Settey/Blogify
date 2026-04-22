"""Local LLM client (Ollama).

Thin async wrapper around the Ollama HTTP API. Follows the same singleton
pattern as `app.services.embeddings`: lazy HTTP client, no model download
happens in-process (the model lives in the Ollama container).

Usage:
    from app.services.llm_client import complete
    answer = await complete("Summarize: ...", system="You are a helpful assistant.")
"""
from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


class LLMError(RuntimeError):
    """Raised when the LLM backend fails or times out."""


@lru_cache(maxsize=1)
def _client() -> httpx.AsyncClient:
    settings = get_settings()
    return httpx.AsyncClient(
        base_url=settings.OLLAMA_BASE_URL,
        timeout=settings.OLLAMA_TIMEOUT_SECONDS,
    )


async def complete(
    prompt: str,
    system: str | None = None,
    max_tokens: int = 256,
    temperature: float = 0.3,
    model: str | None = None,
) -> str:
    """Generate a completion from the local LLM.

    Returns the generated text. Raises LLMError on transport / server failure.
    """
    settings = get_settings()
    payload: dict[str, Any] = {
        "model": model or settings.OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }
    if system:
        payload["system"] = system

    try:
        resp = await _client().post("/api/generate", json=payload)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("LLM call failed: %s", exc)
        raise LLMError(str(exc)) from exc

    data = resp.json()
    return (data.get("response") or "").strip()


async def is_available() -> bool:
    """Quick health check — used by /metrics and admin UIs."""
    try:
        resp = await _client().get("/api/tags", timeout=5.0)
        return resp.status_code == 200
    except httpx.HTTPError:
        return False

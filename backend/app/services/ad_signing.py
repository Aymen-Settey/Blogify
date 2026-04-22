"""Short-lived signed tokens for ad impressions and click-through.

We issue a token when an ad is served, then verify it on /click to ensure
the click references a real impression and hasn't been forged.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

from app.config import get_settings

_settings = get_settings()
_SECRET = _settings.JWT_SECRET_KEY.encode()

# Clicks must happen within this window of the impression
CLICK_TTL_SECONDS = 60 * 60  # 1 hour


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(token: str) -> bytes:
    pad = "=" * (-len(token) % 4)
    return base64.urlsafe_b64decode(token + pad)


def sign_impression(campaign_id: str, post_id: str | None, ts: int | None = None) -> str:
    payload = {"c": campaign_id, "p": post_id or "", "t": ts or int(time.time())}
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    sig = _b64(hmac.new(_SECRET, body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"


def verify_impression(token: str) -> dict | None:
    """Return payload dict if valid, else None."""
    if not token or "." not in token:
        return None
    try:
        body, sig = token.split(".", 1)
        expected = _b64(hmac.new(_SECRET, body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(_unb64(body))
    except Exception:  # noqa: BLE001
        return None
    ts = int(payload.get("t", 0))
    if abs(time.time() - ts) > CLICK_TTL_SECONDS:
        return None
    return payload


def fingerprint_hash(ip: str | None, user_agent: str | None) -> str:
    """Salted SHA-256 of ip + user-agent for privacy-preserving dedupe."""
    h = hashlib.sha256()
    h.update(_SECRET)
    h.update((ip or "").encode())
    h.update(b"|")
    h.update((user_agent or "").encode())
    return h.hexdigest()

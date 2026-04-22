"""Content moderation — soft-flag scoring.

Returns a toxicity score in [0, 1]. Uses a lightweight HuggingFace classifier
when available (``unitary/toxic-bert`` via transformers pipeline, cached from
model hub) and falls back to a small heuristic word list for MVP / offline
environments.
"""
from __future__ import annotations

import logging
import re
from functools import lru_cache

logger = logging.getLogger(__name__)

# Tiny heuristic fallback — deliberately conservative. Real signal comes from
# the transformer when it's available.
_HEURISTIC_TERMS = {
    "idiot", "stupid", "moron", "hate", "kill yourself", "kys",
    "retard", "faggot", "nigger", "whore", "bitch", "cunt", "dumbass",
}


@lru_cache(maxsize=1)
def _classifier():
    """Lazy-load unitary/toxic-bert. Returns None if transformers missing."""
    try:
        from transformers import pipeline

        clf = pipeline(
            "text-classification",
            model="unitary/toxic-bert",
            top_k=None,
            device=-1,  # CPU
        )
        logger.info("[moderation] toxic-bert loaded")
        return clf
    except Exception as exc:  # noqa: BLE001
        logger.warning("[moderation] transformer model unavailable, using heuristic: %s", exc)
        return None


def _heuristic_score(text: str) -> float:
    """Crude per-word hit rate, clamped to [0, 1]."""
    if not text:
        return 0.0
    low = text.lower()
    hits = sum(1 for term in _HEURISTIC_TERMS if term in low)
    if hits == 0:
        return 0.0
    # First hit → 0.5, each extra → +0.15 up to 0.95
    return min(0.95, 0.5 + 0.15 * (hits - 1))


def score_toxicity(text: str) -> float:
    """Return toxicity probability in [0, 1]. Never raises."""
    if not text or not text.strip():
        return 0.0

    clf = _classifier()
    if clf is None:
        return _heuristic_score(text)

    try:
        # toxic-bert emits several labels; max over the "toxic" ones is the signal.
        # Keep text short to bound CPU time.
        snippet = re.sub(r"\s+", " ", text)[:1500]
        out = clf(snippet, truncation=True, max_length=512)
        # out can be [[{label,score},...]] or [{label,score},...]
        rows = out[0] if isinstance(out, list) and out and isinstance(out[0], list) else out
        toxic_labels = {"toxic", "severe_toxic", "obscene", "threat", "insult", "identity_hate"}
        scores = [float(r["score"]) for r in rows if r.get("label") in toxic_labels]
        if not scores:
            return 0.0
        return max(scores)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[moderation] classifier failed, falling back: %s", exc)
        return _heuristic_score(text)

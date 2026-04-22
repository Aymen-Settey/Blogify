"""Extractive summarization using sentence embeddings.

Picks top-K sentences by centrality (cosine similarity to the document mean).
No extra model download beyond the embedding model.
"""
from __future__ import annotations

import re

import numpy as np

from app.services.embeddings import embed_batch

_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9])")


def split_sentences(text: str) -> list[str]:
    text = text.strip()
    if not text:
        return []
    # Simple splitter; good enough for general prose.
    sentences = [s.strip() for s in _SENT_SPLIT.split(text) if s.strip()]
    # Filter out ultra-short fragments
    return [s for s in sentences if len(s.split()) >= 4]


def summarize(text: str, max_sentences: int = 3, max_chars: int = 400) -> str:
    """Return an extractive summary of up to `max_sentences` / `max_chars`."""
    sentences = split_sentences(text)
    if not sentences:
        return ""
    if len(sentences) <= max_sentences:
        summary = " ".join(sentences)
        return summary[:max_chars].rstrip()

    vectors = np.asarray(embed_batch(sentences), dtype=np.float32)
    centroid = vectors.mean(axis=0)
    norm = np.linalg.norm(centroid)
    if norm > 0:
        centroid = centroid / norm

    # Cosine sim to centroid (vectors already L2-normalized from embed_batch)
    scores = vectors @ centroid

    # Pick top-K indices but preserve original order for readability
    top_idx = np.argsort(-scores)[:max_sentences]
    top_idx = sorted(top_idx.tolist())
    summary = " ".join(sentences[i] for i in top_idx)
    if len(summary) > max_chars:
        summary = summary[: max_chars - 1].rstrip() + "…"
    return summary

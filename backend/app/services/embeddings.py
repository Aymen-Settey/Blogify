"""Sentence-Transformers embedding service (singleton model)."""
from __future__ import annotations

import logging
import threading
from functools import lru_cache
from typing import Iterable

import numpy as np

logger = logging.getLogger(__name__)

# all-MiniLM-L6-v2: 384-dim, fast, good general-purpose quality
DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIM = 384

_model_lock = threading.Lock()
_model = None


def get_model():
    """Lazy-load the sentence-transformer model (thread-safe)."""
    global _model
    if _model is not None:
        return _model
    with _model_lock:
        if _model is None:
            from sentence_transformers import SentenceTransformer

            logger.info("Loading embedding model: %s", DEFAULT_MODEL)
            _model = SentenceTransformer(DEFAULT_MODEL)
    return _model


def embed_text(text: str) -> list[float]:
    """Embed a single text string. Returns a 384-dim float list."""
    if not text or not text.strip():
        return [0.0] * EMBEDDING_DIM
    model = get_model()
    vec = model.encode(text, normalize_embeddings=True, convert_to_numpy=True)
    return vec.astype(float).tolist()


def embed_batch(texts: Iterable[str]) -> list[list[float]]:
    """Embed a batch of texts."""
    texts = [t if t and t.strip() else " " for t in texts]
    if not texts:
        return []
    model = get_model()
    vecs = model.encode(list(texts), normalize_embeddings=True, convert_to_numpy=True, batch_size=32)
    return [v.astype(float).tolist() for v in vecs]


def average_vectors(vectors: list[list[float]]) -> list[float]:
    """Mean-pool a list of vectors (then L2-normalize). Returns zero vector if empty."""
    if not vectors:
        return [0.0] * EMBEDDING_DIM
    arr = np.asarray(vectors, dtype=np.float32)
    mean = arr.mean(axis=0)
    norm = np.linalg.norm(mean)
    if norm > 0:
        mean = mean / norm
    return mean.astype(float).tolist()


@lru_cache(maxsize=512)
def embed_cached(text: str) -> tuple[float, ...]:
    """Cache-friendly variant for short repeatable strings (e.g. tag candidates)."""
    return tuple(embed_text(text))

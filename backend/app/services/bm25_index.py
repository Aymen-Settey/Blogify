"""BM25 lexical search index over published posts.

Rebuilds an in-process index from Postgres at most once every
``BM25_INDEX_TTL_SECONDS`` (default 5 min). The index is tiny compared to
the ML models already loaded, so keeping it in memory is fine.
"""
from __future__ import annotations

import logging
import threading
import time

from sqlalchemy import select

from app.config import get_settings
from app.database import sync_session
from app.models.post import Post, PostStatus
from app.services.text_extract import extract_text

logger = logging.getLogger(__name__)
_settings = get_settings()

# --- module state (in-process cache) ------------------------------------------------
_lock = threading.Lock()
_bm25 = None           # bm25s.BM25 instance
_post_ids: list[str] = []
_payloads: list[dict] = []
_built_at: float = 0.0
_tokenizer = None      # bm25s.tokenization.Tokenizer


def _tokenize(texts: list[str]):
    """Stem + lowercase tokenization. Lazy-imports bm25s so the module stays
    importable even if the library is missing."""
    global _tokenizer
    import bm25s

    if _tokenizer is None:
        try:
            import Stemmer  # type: ignore

            stemmer = Stemmer.Stemmer("english")
        except Exception:  # noqa: BLE001
            stemmer = None
        _tokenizer = bm25s.tokenization.Tokenizer(
            stopwords="en",
            stemmer=stemmer,
        )
    # fit+transform on first call, transform-only afterwards
    tokenized = _tokenizer.tokenize(texts, update_vocab=True, return_as="tuple")
    return tokenized


def _tokenize_query(text: str):
    """Tokenize a single query using the existing tokenizer's vocab."""
    import bm25s

    if _tokenizer is None:
        # No corpus yet → can't answer.
        return None
    tokenized = _tokenizer.tokenize([text], update_vocab=False, return_as="tuple")
    return tokenized


def _build_now() -> None:
    """Pull all published posts from Postgres and build a fresh BM25 index."""
    global _bm25, _post_ids, _payloads, _built_at, _tokenizer

    try:
        import bm25s
    except Exception as exc:  # noqa: BLE001
        logger.warning("[bm25] library not installed: %s", exc)
        _bm25 = None
        _built_at = time.time()  # avoid hammering retries
        return

    texts: list[str] = []
    ids: list[str] = []
    payloads: list[dict] = []

    with sync_session() as db:
        rows = db.execute(
            select(Post).where(Post.status == PostStatus.PUBLISHED)
        ).scalars().all()
        for p in rows:
            body = extract_text(p.content) if p.content else ""
            doc = f"{p.title or ''}\n{body}".strip()
            if not doc:
                continue
            ids.append(str(p.id))
            payloads.append(
                {
                    "author_id": str(p.author_id),
                    "field": p.field,
                    "language": p.language,
                    "slug": p.slug,
                    "title": p.title,
                    "published_at_ts": int(p.published_at.timestamp()) if p.published_at else 0,
                }
            )
            texts.append(doc)

    if not texts:
        _bm25 = None
        _post_ids = []
        _payloads = []
        _built_at = time.time()
        logger.info("[bm25] no published posts — index empty")
        return

    # Reset tokenizer so fit uses the latest corpus vocab.
    _tokenizer = None
    tokens = _tokenize(texts)

    bm25 = bm25s.BM25()
    bm25.index(tokens)

    _bm25 = bm25
    _post_ids = ids
    _payloads = payloads
    _built_at = time.time()
    logger.info("[bm25] indexed %d posts", len(ids))


def ensure_built(force: bool = False) -> None:
    """Build/refresh the index if stale or missing. Thread-safe."""
    ttl = _settings.BM25_INDEX_TTL_SECONDS
    now = time.time()
    if not force and _bm25 is not None and (now - _built_at) < ttl:
        return
    with _lock:
        if not force and _bm25 is not None and (time.time() - _built_at) < ttl:
            return
        try:
            _build_now()
        except Exception as exc:  # noqa: BLE001
            logger.warning("[bm25] build failed: %s", exc)


def search_bm25(
    query: str,
    limit: int = 20,
    field: str | None = None,
    language: str | None = None,
) -> list[tuple[str, float, dict]]:
    """Return [(post_id, score, payload)] ranked by BM25.

    Applies optional field/language filters AFTER scoring — at our corpus size
    this is negligible and avoids rebuilding per-filter indexes.
    """
    ensure_built()
    if _bm25 is None or not _post_ids:
        return []

    tokens = _tokenize_query(query)
    if tokens is None:
        return []

    # Over-fetch so post-filters still yield `limit` items.
    k = min(len(_post_ids), max(limit * 3, limit))
    try:
        results, scores = _bm25.retrieve(tokens, k=k)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[bm25] retrieve failed: %s", exc)
        return []

    # results shape: (n_queries, k) of corpus indices
    idx_row = results[0]
    score_row = scores[0]

    out: list[tuple[str, float, dict]] = []
    for doc_idx, score in zip(idx_row, score_row):
        doc_idx = int(doc_idx)
        if doc_idx < 0 or doc_idx >= len(_post_ids):
            continue
        payload = _payloads[doc_idx]
        if field and payload.get("field") != field:
            continue
        if language and payload.get("language") != language:
            continue
        out.append((_post_ids[doc_idx], float(score), payload))
        if len(out) >= limit:
            break
    return out


def invalidate() -> None:
    """Mark the index stale so the next call rebuilds it."""
    global _built_at
    _built_at = 0.0

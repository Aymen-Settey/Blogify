"""Hybrid retrieval — Reciprocal Rank Fusion of dense + BM25,
optionally followed by cross-encoder reranking.

Each candidate is returned as ``(post_id, score, payload, explanation)`` where
``explanation`` is a dict of per-component scores suitable for the PostResponse
`explanation` field.
"""
from __future__ import annotations

import logging

from app.config import get_settings
from app.services.bm25_index import search_bm25
from app.services.vector_store import search_similar_posts

logger = logging.getLogger(__name__)
_settings = get_settings()


def _rrf_fuse(
    dense: list[tuple[str, float, dict]],
    bm25: list[tuple[str, float, dict]],
    k: int,
) -> list[tuple[str, dict]]:
    """Reciprocal Rank Fusion.

    Returns [(post_id, explanation)] sorted by fused score desc.
    explanation keys: rrf, dense, bm25, dense_rank, bm25_rank
    """
    explanations: dict[str, dict] = {}

    for rank, (pid, score, _payload) in enumerate(dense, start=1):
        e = explanations.setdefault(pid, {"rrf": 0.0})
        e["dense"] = float(score)
        e["dense_rank"] = rank
        e["rrf"] += 1.0 / (k + rank)

    for rank, (pid, score, _payload) in enumerate(bm25, start=1):
        e = explanations.setdefault(pid, {"rrf": 0.0})
        e["bm25"] = float(score)
        e["bm25_rank"] = rank
        e["rrf"] += 1.0 / (k + rank)

    ordered = sorted(explanations.items(), key=lambda kv: kv[1]["rrf"], reverse=True)
    return ordered


def hybrid_search_posts(
    query: str,
    vector: list[float],
    limit: int = 20,
    field: str | None = None,
    language: str | None = None,
    exclude_post_ids: list[str] | None = None,
    exclude_author_ids: list[str] | None = None,
) -> list[tuple[str, dict]]:
    """Combine dense + BM25 via RRF. Returns [(post_id, explanation)]."""
    fetch_n = max(limit * 3, 30)

    dense_hits: list[tuple[str, float, dict]] = []
    try:
        dense_hits = search_similar_posts(
            vector,
            limit=fetch_n,
            exclude_post_ids=exclude_post_ids,
            exclude_author_ids=exclude_author_ids,
            field=field,
            language=language,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("[hybrid] dense search failed: %s", exc)

    bm25_hits: list[tuple[str, float, dict]] = []
    if _settings.HYBRID_SEARCH_ENABLED and query.strip():
        try:
            bm25_hits = search_bm25(
                query,
                limit=fetch_n,
                field=field,
                language=language,
            )
            # Apply the same exclusions as dense.
            if exclude_post_ids:
                excl = set(exclude_post_ids)
                bm25_hits = [h for h in bm25_hits if h[0] not in excl]
            if exclude_author_ids:
                excl_a = set(exclude_author_ids)
                bm25_hits = [h for h in bm25_hits if h[2].get("author_id") not in excl_a]
        except Exception as exc:  # noqa: BLE001
            logger.warning("[hybrid] bm25 search failed: %s", exc)

    if not dense_hits and not bm25_hits:
        return []

    # If one side is empty, short-circuit to avoid pure-RRF penalty.
    if not bm25_hits:
        return [
            (pid, {"dense": float(s), "dense_rank": r})
            for r, (pid, s, _p) in enumerate(dense_hits[:limit], start=1)
        ]
    if not dense_hits:
        return [
            (pid, {"bm25": float(s), "bm25_rank": r})
            for r, (pid, s, _p) in enumerate(bm25_hits[:limit], start=1)
        ]

    fused = _rrf_fuse(dense_hits, bm25_hits, k=_settings.RRF_K)
    return fused[:limit]


# --- Reranker -----------------------------------------------------------------------

_reranker = None  # lazy singleton


def _get_reranker():
    global _reranker
    if _reranker is not None:
        return _reranker
    try:
        from sentence_transformers import CrossEncoder

        _reranker = CrossEncoder(_settings.RERANKER_MODEL_NAME, max_length=512)
        logger.info("[rerank] loaded %s", _settings.RERANKER_MODEL_NAME)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[rerank] failed to load model: %s", exc)
        _reranker = None
    return _reranker


def rerank_candidates(
    query: str,
    candidates: list[tuple[str, dict, str]],
    top_k: int | None = None,
) -> list[tuple[str, dict]]:
    """Cross-encoder rerank.

    `candidates` is [(post_id, explanation, doc_text)]. Updates explanation in
    place with ``rerank`` score and returns reordered [(post_id, explanation)].
    Falls back to the original order if the reranker is unavailable.
    """
    if not candidates or not _settings.RERANKER_ENABLED:
        return [(pid, expl) for pid, expl, _doc in candidates]

    model = _get_reranker()
    if model is None:
        return [(pid, expl) for pid, expl, _doc in candidates]

    top_k = top_k or len(candidates)
    head = candidates[: _settings.RERANKER_TOP_K]
    tail = candidates[_settings.RERANKER_TOP_K :]

    pairs = [(query, doc) for _pid, _expl, doc in head]
    try:
        scores = model.predict(pairs, show_progress_bar=False)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[rerank] predict failed: %s", exc)
        return [(pid, expl) for pid, expl, _doc in candidates]

    scored_head = []
    for (pid, expl, _doc), s in zip(head, scores):
        expl = dict(expl)
        expl["rerank"] = float(s)
        scored_head.append((pid, expl))
    scored_head.sort(key=lambda x: x[1]["rerank"], reverse=True)

    final = scored_head + [(pid, expl) for pid, expl, _doc in tail]
    return final[:top_k]

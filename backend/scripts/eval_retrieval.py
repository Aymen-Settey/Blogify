"""Offline retrieval evaluation harness.

Runs a tiny hand-authored query set against the semantic search endpoint and
reports Hit Rate @ K and MRR @ K. Intended as a smoke-test during model /
ranker changes; NOT a production-grade eval.

Usage inside the backend container:

    docker compose exec -e PYTHONPATH=/app backend python scripts/eval_retrieval.py

Extend ``QUERIES`` with entries of shape {query, relevant_slugs, field?}.
"""
from __future__ import annotations

import logging
import statistics
import sys
from dataclasses import dataclass

from app.services.bm25_index import ensure_built
from app.services.embeddings import embed_text
from app.services.hybrid_search import hybrid_search_posts
from app.database import sync_session
from app.models.user import User  # noqa: F401 — register mapper
from app.models.interaction import Interaction, Bookmark  # noqa: F401
from app.models.comment import Comment  # noqa: F401
from app.models.post import Post, PostStatus
from sqlalchemy import select

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("eval")

K = 10


@dataclass
class Query:
    query: str
    relevant_slugs: set[str]
    field: str | None = None
    language: str | None = None


QUERIES: list[Query] = [
    # These are placeholders — fill with real (query, gold slug) pairs from your
    # seed data to track retrieval quality across model/ranker changes.
    Query("natural language processing", {"nlp-2b85f90a"}),
    Query("nlp transformers", {"nlp-2b85f90a"}),
]


def _slugs_from_ids(ids: list[str]) -> list[str]:
    if not ids:
        return []
    with sync_session() as db:
        rows = db.execute(
            select(Post.id, Post.slug).where(Post.id.in_(ids))
        ).all()
    by_id = {str(rid): slug for rid, slug in rows}
    return [by_id.get(i, "") for i in ids]


def _hit_rate(retrieved: list[str], relevant: set[str]) -> float:
    return 1.0 if any(s in relevant for s in retrieved) else 0.0


def _mrr(retrieved: list[str], relevant: set[str]) -> float:
    for i, s in enumerate(retrieved, start=1):
        if s in relevant:
            return 1.0 / i
    return 0.0


def run() -> int:
    ensure_built()
    hits = []
    mrrs = []

    for q in QUERIES:
        try:
            vec = embed_text(q.query)
        except Exception as exc:  # noqa: BLE001
            log.warning("embed failed for %r: %s", q.query, exc)
            continue

        fused = hybrid_search_posts(
            q.query,
            vec,
            limit=K,
            field=q.field,
            language=q.language,
        )
        ids = [pid for pid, _e in fused]
        slugs = _slugs_from_ids(ids)
        h = _hit_rate(slugs, q.relevant_slugs)
        m = _mrr(slugs, q.relevant_slugs)
        hits.append(h)
        mrrs.append(m)
        log.info("query=%r hit@%d=%.0f mrr@%d=%.3f retrieved=%s",
                 q.query, K, h, K, m, slugs[:3])

    if not hits:
        log.warning("No queries evaluated.")
        return 1

    log.info("--- summary over %d queries ---", len(hits))
    log.info("HitRate@%d = %.3f", K, statistics.mean(hits))
    log.info("MRR@%d     = %.3f", K, statistics.mean(mrrs))
    return 0


if __name__ == "__main__":
    sys.exit(run())

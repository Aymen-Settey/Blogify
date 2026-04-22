"""Qdrant vector store wrapper.

Two collections:
- `posts`  : one vector per published post (payload: author_id, field, language, tags, published_at_ts)
- `users`  : one vector per active user representing their interest profile
"""
from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from app.config import get_settings
from app.services.embeddings import EMBEDDING_DIM

logger = logging.getLogger(__name__)


def _settings():
    return get_settings()


# Module-level constants derived from settings at import time so that
# existing `from app.services.vector_store import POSTS_COLLECTION` keeps working.
# To swap collections, set POSTS_COLLECTION / USERS_COLLECTION env vars and restart.
POSTS_COLLECTION = _settings().POSTS_COLLECTION
USERS_COLLECTION = _settings().USERS_COLLECTION


@lru_cache(maxsize=1)
def get_client() -> QdrantClient:
    settings = get_settings()
    return QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)


def ensure_collections() -> None:
    """Create required collections if they don't exist. Idempotent."""
    client = get_client()
    existing = {c.name for c in client.get_collections().collections}

    vector_config = qmodels.VectorParams(
        size=EMBEDDING_DIM,
        distance=qmodels.Distance.COSINE,
    )

    for name in (POSTS_COLLECTION, USERS_COLLECTION):
        if name not in existing:
            logger.info("Creating Qdrant collection: %s", name)
            client.create_collection(collection_name=name, vectors_config=vector_config)


def upsert_post_vector(
    post_id: str,
    vector: list[float],
    payload: dict[str, Any],
) -> None:
    client = get_client()
    client.upsert(
        collection_name=POSTS_COLLECTION,
        points=[
            qmodels.PointStruct(id=post_id, vector=vector, payload=payload),
        ],
    )


def upsert_user_vector(
    user_id: str,
    vector: list[float],
    payload: dict[str, Any] | None = None,
) -> None:
    client = get_client()
    client.upsert(
        collection_name=USERS_COLLECTION,
        points=[
            qmodels.PointStruct(id=user_id, vector=vector, payload=payload or {}),
        ],
    )


def delete_post_vector(post_id: str) -> None:
    client = get_client()
    try:
        client.delete(
            collection_name=POSTS_COLLECTION,
            points_selector=qmodels.PointIdsList(points=[post_id]),
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to delete post vector %s: %s", post_id, exc)


def get_user_vector(user_id: str) -> list[float] | None:
    client = get_client()
    try:
        res = client.retrieve(
            collection_name=USERS_COLLECTION,
            ids=[user_id],
            with_vectors=True,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to retrieve user vector %s: %s", user_id, exc)
        return None
    if not res:
        return None
    point = res[0]
    vec = point.vector
    if isinstance(vec, dict):  # named vectors (not used here)
        vec = next(iter(vec.values()), None)
    return list(vec) if vec else None


def search_similar_posts(
    vector: list[float],
    limit: int = 20,
    exclude_post_ids: list[str] | None = None,
    exclude_author_ids: list[str] | None = None,
    field: str | None = None,
    language: str | None = None,
) -> list[tuple[str, float, dict]]:
    """Return [(post_id, score, payload)] for posts most similar to `vector`."""
    client = get_client()
    must_not: list[qmodels.FieldCondition] = []
    must: list[qmodels.FieldCondition] = []

    if exclude_author_ids:
        must_not.append(
            qmodels.FieldCondition(
                key="author_id",
                match=qmodels.MatchAny(any=exclude_author_ids),
            )
        )
    if field:
        must.append(qmodels.FieldCondition(key="field", match=qmodels.MatchValue(value=field)))
    if language:
        must.append(qmodels.FieldCondition(key="language", match=qmodels.MatchValue(value=language)))

    query_filter = None
    if must or must_not:
        query_filter = qmodels.Filter(must=must or None, must_not=must_not or None)

    # qdrant-client >=1.13 deprecated .search() in favor of .query_points().
    response = client.query_points(
        collection_name=POSTS_COLLECTION,
        query=vector,
        limit=limit + (len(exclude_post_ids) if exclude_post_ids else 0),
        query_filter=query_filter,
        with_payload=True,
    )
    hits = response.points

    exclude = set(exclude_post_ids or [])
    results: list[tuple[str, float, dict]] = []
    for h in hits:
        pid = str(h.id)
        if pid in exclude:
            continue
        results.append((pid, float(h.score), dict(h.payload or {})))
        if len(results) >= limit:
            break
    return results

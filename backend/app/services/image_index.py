"""Qdrant wrapper for the CLIP image collection.

Collection is separate from `posts_*` because vectors live in a different
space (CLIP 512-d vs MiniLM 384-d). Payload tracks provenance + ownership so
we can filter by uploader and delete by URL.

Payload shape:
    {
        "url":          "/media/abcd.jpg",
        "uploader_id":  "<uuid str>",
        "post_id":      "<uuid str>" | None,
        "content_type": "image/png",
        "alt_text":     "optional caption",
        "created_at_ts": 1713350400
    }
"""
from __future__ import annotations

import logging
from typing import Any

from qdrant_client.http import models as qmodels

from app.config import get_settings
from app.services.vector_store import get_client

logger = logging.getLogger(__name__)


def _collection() -> str:
    return get_settings().IMAGES_COLLECTION


def ensure_image_collection() -> None:
    """Create the CLIP image collection if missing. Idempotent."""
    client = get_client()
    existing = {c.name for c in client.get_collections().collections}
    name = _collection()
    if name in existing:
        return
    logger.info("Creating Qdrant collection: %s", name)
    client.create_collection(
        collection_name=name,
        vectors_config=qmodels.VectorParams(
            size=get_settings().CLIP_EMBEDDING_DIM,
            distance=qmodels.Distance.COSINE,
        ),
    )


def upsert_image(
    image_id: str,
    vector: list[float],
    url: str,
    uploader_id: str,
    post_id: str | None = None,
    content_type: str | None = None,
    alt_text: str | None = None,
    created_at_ts: int | None = None,
) -> None:
    client = get_client()
    payload: dict[str, Any] = {
        "url": url,
        "uploader_id": uploader_id,
        "post_id": post_id,
        "content_type": content_type,
        "alt_text": alt_text,
        "created_at_ts": created_at_ts or 0,
    }
    client.upsert(
        collection_name=_collection(),
        points=[qmodels.PointStruct(id=image_id, vector=vector, payload=payload)],
    )


def delete_image(image_id: str) -> None:
    client = get_client()
    try:
        client.delete(
            collection_name=_collection(),
            points_selector=qmodels.PointIdsList(points=[image_id]),
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("delete_image %s failed: %s", image_id, exc)


def search_images(
    vector: list[float],
    limit: int = 24,
    uploader_id: str | None = None,
    post_id: str | None = None,
) -> list[tuple[str, float, dict]]:
    """Return [(image_id, score, payload)] for images most similar to `vector`."""
    client = get_client()
    must: list[qmodels.FieldCondition] = []
    if uploader_id:
        must.append(
            qmodels.FieldCondition(key="uploader_id", match=qmodels.MatchValue(value=uploader_id))
        )
    if post_id:
        must.append(
            qmodels.FieldCondition(key="post_id", match=qmodels.MatchValue(value=post_id))
        )
    query_filter = qmodels.Filter(must=must) if must else None

    try:
        response = client.query_points(
            collection_name=_collection(),
            query=vector,
            limit=limit,
            query_filter=query_filter,
            with_payload=True,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("search_images failed: %s", exc)
        return []

    return [
        (str(h.id), float(h.score), dict(h.payload or {}))
        for h in response.points
    ]

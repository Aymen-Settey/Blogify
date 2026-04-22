"""CLIP image search endpoints (Phase 4.3).

Two retrieval modes share the same CLIP vector space:
- GET  /api/search/images?q=...                 (text → image)
- POST /api/search/images/by-image (multipart)  (image → image)
"""
from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from app.config import get_settings
from app.services.clip_embeddings import embed_image_bytes, embed_text
from app.services.image_index import ensure_image_collection, search_images

router = APIRouter(prefix="/api/search/images", tags=["search-images"])

_ALLOWED = {"image/jpeg", "image/png", "image/gif", "image/webp"}
_MAX_BYTES = 10 * 1024 * 1024


def _format_hits(hits: list[tuple[str, float, dict]]) -> list[dict]:
    out: list[dict] = []
    for image_id, score, payload in hits:
        out.append(
            {
                "image_id": image_id,
                "score": round(score, 4),
                "url": payload.get("url"),
                "uploader_id": payload.get("uploader_id"),
                "post_id": payload.get("post_id"),
                "alt_text": payload.get("alt_text"),
                "content_type": payload.get("content_type"),
            }
        )
    return out


@router.get("")
async def search_by_text(
    q: str = Query(..., min_length=1, max_length=300),
    limit: int = Query(24, ge=1, le=100),
    uploader_id: str | None = None,
    post_id: str | None = None,
):
    if not get_settings().IMAGE_SEARCH_ENABLED:
        raise HTTPException(status_code=503, detail="Image search is disabled")

    ensure_image_collection()

    vector = embed_text(q)
    if vector is None:
        raise HTTPException(status_code=503, detail="CLIP model unavailable")

    hits = search_images(vector, limit=limit, uploader_id=uploader_id, post_id=post_id)
    return {"query": q, "mode": "text", "results": _format_hits(hits)}


@router.post("/by-image")
async def search_by_image(
    file: UploadFile = File(...),
    limit: int = Query(24, ge=1, le=100),
):
    if not get_settings().IMAGE_SEARCH_ENABLED:
        raise HTTPException(status_code=503, detail="Image search is disabled")
    if file.content_type not in _ALLOWED:
        raise HTTPException(status_code=400, detail="Invalid image type")

    data = await file.read()
    if len(data) > _MAX_BYTES:
        raise HTTPException(status_code=400, detail="Image too large (max 10MB)")

    ensure_image_collection()

    vector = embed_image_bytes(data)
    if vector is None:
        raise HTTPException(status_code=503, detail="CLIP model unavailable")

    hits = search_images(vector, limit=limit)
    return {"mode": "image", "results": _format_hits(hits)}

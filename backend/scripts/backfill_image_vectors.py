"""Backfill CLIP image vectors.

Iterates cover images on published posts, fetches bytes from MinIO,
CLIP-embeds them, and upserts into ``IMAGES_COLLECTION``. Safe to re-run.

Run inside the backend container:

    docker compose exec -e PYTHONPATH=/app backend python scripts/backfill_image_vectors.py
"""
from __future__ import annotations

import logging
import sys
import uuid

from sqlalchemy import select

from app.database import sync_session
from app.models.user import User  # noqa: F401 — register mapper
from app.models.interaction import Interaction, Bookmark  # noqa: F401 — register mappers
from app.models.comment import Comment  # noqa: F401 — register mapper
from app.models.post import Post, PostStatus
from app.services.clip_embeddings import embed_image_bytes
from app.services.image_index import ensure_image_collection, upsert_image
from app.services.storage import fetch_bytes_by_url

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("backfill-images")


def _deterministic_id(url: str) -> str:
    """Stable UUID per URL so re-runs update in place instead of duplicating."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, url))


def main() -> int:
    ensure_image_collection()

    with sync_session() as db:
        rows = db.execute(
            select(Post)
            .where(Post.status == PostStatus.PUBLISHED)
            .where(Post.cover_image_url.is_not(None))
        ).scalars().all()

    total = len(rows)
    log.info("Backfilling %d cover images…", total)
    ok = skipped = failed = 0

    for i, p in enumerate(rows, start=1):
        url = p.cover_image_url
        try:
            data = fetch_bytes_by_url(url)
            if not data:
                skipped += 1
                continue
            vector = embed_image_bytes(data)
            if vector is None:
                skipped += 1
                continue
            upsert_image(
                image_id=_deterministic_id(url),
                vector=vector,
                url=url,
                uploader_id=str(p.author_id),
                post_id=str(p.id),
                content_type=None,
                alt_text=p.title,
                created_at_ts=int(p.published_at.timestamp()) if p.published_at else 0,
            )
            ok += 1
        except Exception as exc:  # noqa: BLE001
            failed += 1
            log.warning("Failed post %s (%s): %s", p.id, url, exc)
        if i % 10 == 0:
            log.info("%d / %d done", i, total)

    log.info("Done. ok=%d skipped=%d failed=%d total=%d", ok, skipped, failed, total)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

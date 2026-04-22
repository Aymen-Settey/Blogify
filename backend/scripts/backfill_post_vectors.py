"""Backfill the post vector index.

Run inside the backend container:

    docker compose exec -e PYTHONPATH=/app backend python scripts/backfill_post_vectors.py

Re-embeds every PUBLISHED post and upserts it into the active
``POSTS_COLLECTION`` — useful after an embedding-model upgrade or a fresh
Qdrant volume.
"""
from __future__ import annotations

import logging
import sys

from sqlalchemy import select

from app.database import sync_session
from app.models.user import User  # noqa: F401 — register mapper
from app.models.interaction import Interaction, Bookmark  # noqa: F401 — register mappers
from app.models.comment import Comment  # noqa: F401 — register mapper
from app.models.post import Post, PostStatus
from app.services.embeddings import embed_text
from app.services.text_extract import extract_text
from app.services.vector_store import ensure_collections, upsert_post_vector

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("backfill")


def main() -> int:
    ensure_collections()

    with sync_session() as db:
        rows = db.execute(
            select(Post).where(Post.status == PostStatus.PUBLISHED)
        ).scalars().all()

    total = len(rows)
    log.info("Backfilling %d published posts…", total)
    ok = failed = 0

    for i, p in enumerate(rows, start=1):
        try:
            text = extract_text(p.content) if p.content else ""
            full = f"{p.title or ''}\n\n{text}".strip()
            vector = embed_text(full or (p.title or " "))
            payload = {
                "author_id": str(p.author_id),
                "field": p.field,
                "language": p.language,
                "tags": (p.tags or []) + (p.auto_tags or []),
                "published_at_ts": int(p.published_at.timestamp()) if p.published_at else 0,
                "title": p.title,
                "slug": p.slug,
            }
            upsert_post_vector(str(p.id), vector, payload)
            ok += 1
        except Exception as exc:  # noqa: BLE001
            failed += 1
            log.warning("Failed post %s: %s", p.id, exc)
        if i % 20 == 0:
            log.info("%d / %d done", i, total)

    log.info("Done. ok=%d failed=%d total=%d", ok, failed, total)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

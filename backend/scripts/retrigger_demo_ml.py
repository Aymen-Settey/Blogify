"""Re-trigger ML pipeline for all demo-seeded posts. Used after worker restart."""
import uuid

from sqlalchemy import select

from app.celery_app import celery_app
from app.database import sync_session
from app.models.comment import Comment  # noqa: F401 — register mapper
from app.models.interaction import Bookmark, Follow, Interaction  # noqa: F401
from app.models.post import Post
from app.models.user import User  # noqa: F401 — register mapper
from app.services.image_index import ensure_image_collection


def main() -> None:
    ensure_image_collection()
    with sync_session() as db:
        posts = db.execute(
            select(Post).where(Post.tags.any("demo-seed"))
        ).scalars().all()
        print(f"Re-triggering ML for {len(posts)} demo posts")
        for p in posts:
            celery_app.send_task("tasks.process_post_ml", args=[str(p.id)])
            if p.cover_image_url:
                celery_app.send_task(
                    "tasks.embed_image",
                    kwargs={
                        "image_id": str(uuid.uuid5(uuid.NAMESPACE_URL, p.cover_image_url)),
                        "url": p.cover_image_url,
                        "uploader_id": str(p.author_id),
                        "post_id": str(p.id),
                        "content_type": "image/jpeg",
                        "alt_text": p.title,
                    },
                )
    print("done")


if __name__ == "__main__":
    main()

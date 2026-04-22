"""Celery ML pipeline tasks."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.celery_app import celery_app
from app.database import sync_session
from app.models.post import Post, PostStatus
from app.models.interaction import Interaction, InteractionType, Bookmark
from app.services.text_extract import extract_text
from app.services.embeddings import embed_text, average_vectors
from app.services.summarizer import summarize
from app.services.tagger import extract_keywords
from app.services.vector_store import (
    ensure_collections,
    upsert_post_vector,
    upsert_user_vector,
    delete_post_vector,
)
from app.services.metrics import track_task

logger = logging.getLogger(__name__)

# How many recent interactions contribute to the user interest vector.
USER_HISTORY_LIMIT = 50


@celery_app.task(name="tasks.process_post_ml", bind=True, max_retries=3, default_retry_delay=30)
@track_task("process_post_ml")
def process_post_ml(self, post_id: str) -> dict:
    """Full ML pipeline for a post:
    1. Extract plain text from Tiptap JSON
    2. Generate embedding → upsert to Qdrant
    3. Generate summary → store on post
    4. Extract keyword tags → store on post
    """
    logger.info("[ML] Processing post %s", post_id)
    try:
        ensure_collections()
    except Exception as exc:  # noqa: BLE001
        logger.warning("[ML] Qdrant ensure_collections failed: %s", exc)
        raise self.retry(exc=exc)

    with sync_session() as db:
        post = db.execute(select(Post).where(Post.id == post_id)).scalar_one_or_none()
        if not post:
            logger.warning("[ML] Post %s not found; skipping.", post_id)
            return {"post_id": post_id, "status": "not_found"}

        text = extract_text(post.content).strip()
        title = post.title or ""
        full = f"{title}\n\n{text}".strip()

        # Auto language detection — only override the default "en" when we are
        # confident (>0.8). Never touch an explicitly-set non-en language.
        if post.language == "en" and full:
            try:
                from app.services.language import detect_language

                detected, conf = detect_language(full)
                if detected and conf > 0.8 and detected != post.language:
                    logger.info(
                        "[ML] Post %s language auto-set %s -> %s (conf=%.2f)",
                        post_id, post.language, detected, conf,
                    )
                    post.language = detected
            except Exception as exc:  # noqa: BLE001
                logger.warning("[ML] Language detection failed for %s: %s", post_id, exc)

        vector = embed_text(full if full else title or " ")

        # Duplicate detection — check against the existing index.
        # >0.98 & same author = re-index of same post (normal); no action.
        # >0.92 & different author = likely plagiarism → flag via duplicate_of_id.
        try:
            from app.services.vector_store import search_similar_posts

            hits = search_similar_posts(
                vector,
                limit=3,
                exclude_post_ids=[str(post.id)],
            )
            for hit_pid, score, payload_hit in hits:
                other_author = str(payload_hit.get("author_id") or "")
                if score > 0.92 and other_author and other_author != str(post.author_id):
                    try:
                        import uuid as _uuid

                        post.duplicate_of_id = _uuid.UUID(hit_pid)
                        logger.info(
                            "[ML] Post %s flagged as duplicate of %s (score=%.3f)",
                            post_id,
                            hit_pid,
                            score,
                        )
                    except (ValueError, TypeError):
                        pass
                    break
        except Exception as exc:  # noqa: BLE001
            logger.warning("[ML] Duplicate check failed for %s: %s", post_id, exc)

        if not post.summary and text:
            try:
                post.summary = summarize(text, max_sentences=3, max_chars=400) or None
            except Exception as exc:  # noqa: BLE001
                logger.warning("[ML] Summarization failed for %s: %s", post_id, exc)

        if text:
            try:
                post.auto_tags = extract_keywords(f"{title}. {text}", top_k=6) or None
            except Exception as exc:  # noqa: BLE001
                logger.warning("[ML] Tagging failed for %s: %s", post_id, exc)

        # Moderation — soft-flag only. We never block publishing; editors
        # review the flagged queue separately.
        if full:
            try:
                from app.config import get_settings
                from app.services.moderation import score_toxicity

                settings = get_settings()
                score = score_toxicity(full)
                post.toxicity_score = float(score)
                post.is_flagged = score > settings.MODERATION_THRESHOLD
                if post.is_flagged:
                    logger.info("[ML] Post %s flagged (toxicity=%.3f)", post_id, score)
            except Exception as exc:  # noqa: BLE001
                logger.warning("[ML] Moderation failed for %s: %s", post_id, exc)

        db.commit()

        if post.status == PostStatus.PUBLISHED:
            payload = {
                "author_id": str(post.author_id),
                "field": post.field,
                "language": post.language,
                "tags": (post.tags or []) + (post.auto_tags or []),
                "published_at_ts": int(post.published_at.timestamp()) if post.published_at else 0,
                "title": post.title,
                "slug": post.slug,
            }
            try:
                upsert_post_vector(str(post.id), vector, payload)
            except Exception as exc:  # noqa: BLE001
                logger.warning("[ML] Qdrant upsert failed for %s: %s", post_id, exc)
                raise self.retry(exc=exc)
        else:
            try:
                delete_post_vector(str(post.id))
            except Exception:  # noqa: BLE001
                pass

    logger.info("[ML] Post %s processed.", post_id)
    return {"post_id": post_id, "status": "ok"}


@celery_app.task(name="tasks.remove_post_vector")
@track_task("remove_post_vector")
def remove_post_vector(post_id: str) -> dict:
    try:
        delete_post_vector(post_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[ML] delete_post_vector failed for %s: %s", post_id, exc)
        return {"post_id": post_id, "status": "error"}
    return {"post_id": post_id, "status": "deleted"}


@celery_app.task(name="tasks.update_user_vector", bind=True, max_retries=3, default_retry_delay=30)
@track_task("update_user_vector")
def update_user_vector(self, user_id: str) -> dict:
    """Recompute a user's interest vector as the mean of vectors of posts they
    recently liked or bookmarked. Falls back to embedding their
    research_interests / bio if there's no interaction history yet."""
    logger.info("[ML] Updating user vector %s", user_id)
    try:
        ensure_collections()
    except Exception as exc:  # noqa: BLE001
        raise self.retry(exc=exc)

    from app.services.vector_store import get_client, POSTS_COLLECTION

    with sync_session() as db:
        liked = db.execute(
            select(Interaction.post_id)
            .where(Interaction.user_id == user_id, Interaction.type == InteractionType.LIKE)
            .order_by(Interaction.created_at.desc())
            .limit(USER_HISTORY_LIMIT)
        ).scalars().all()
        bookmarked = db.execute(
            select(Bookmark.post_id)
            .where(Bookmark.user_id == user_id)
            .order_by(Bookmark.created_at.desc())
            .limit(USER_HISTORY_LIMIT)
        ).scalars().all()

        post_ids = list({str(pid) for pid in list(liked) + list(bookmarked)})

        vectors: list[list[float]] = []
        if post_ids:
            try:
                client = get_client()
                points = client.retrieve(
                    collection_name=POSTS_COLLECTION,
                    ids=post_ids,
                    with_vectors=True,
                )
                for p in points:
                    v = p.vector
                    if isinstance(v, dict):
                        v = next(iter(v.values()), None)
                    if v:
                        vectors.append(list(v))
            except Exception as exc:  # noqa: BLE001
                logger.warning("[ML] Fetching post vectors for user %s failed: %s", user_id, exc)

        if not vectors:
            from app.models.user import User

            user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
            if not user:
                return {"user_id": user_id, "status": "not_found"}
            seed_parts: list[str] = []
            if user.research_interests:
                seed_parts.extend(user.research_interests)
            if user.bio:
                seed_parts.append(user.bio)
            seed = " ".join(seed_parts).strip()
            if not seed:
                return {"user_id": user_id, "status": "no_signal"}
            vectors = [embed_text(seed)]

        user_vec = average_vectors(vectors)
        payload = {"updated_ts": int(datetime.now(timezone.utc).timestamp())}
        try:
            upsert_user_vector(user_id, user_vec, payload)
        except Exception as exc:  # noqa: BLE001
            raise self.retry(exc=exc)

    return {"user_id": user_id, "status": "ok", "sources": len(vectors)}


@celery_app.task(name="tasks.embed_image", bind=True, max_retries=2, default_retry_delay=15)
@track_task("embed_image")
def embed_image(
    self,
    image_id: str,
    url: str,
    uploader_id: str,
    post_id: str | None = None,
    content_type: str | None = None,
    alt_text: str | None = None,
) -> dict:
    """Fetch image bytes from MinIO, CLIP-embed, upsert to images collection."""
    from app.services.clip_embeddings import embed_image_bytes
    from app.services.image_index import ensure_image_collection, upsert_image
    from app.services.storage import fetch_bytes_by_url

    try:
        ensure_image_collection()
    except Exception as exc:  # noqa: BLE001
        logger.warning("[ML] ensure_image_collection failed: %s", exc)
        raise self.retry(exc=exc)

    data = fetch_bytes_by_url(url)
    if not data:
        logger.warning("[ML] Image bytes unavailable for %s (%s)", image_id, url)
        return {"image_id": image_id, "status": "not_found"}

    vector = embed_image_bytes(data)
    if vector is None:
        logger.warning("[ML] CLIP embedding failed for %s", image_id)
        return {"image_id": image_id, "status": "embed_failed"}

    try:
        upsert_image(
            image_id=image_id,
            vector=vector,
            url=url,
            uploader_id=uploader_id,
            post_id=post_id,
            content_type=content_type,
            alt_text=alt_text,
            created_at_ts=int(datetime.now(timezone.utc).timestamp()),
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("[ML] upsert_image failed for %s: %s", image_id, exc)
        raise self.retry(exc=exc)

    return {"image_id": image_id, "status": "ok"}

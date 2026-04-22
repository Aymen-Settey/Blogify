"""Recommendation endpoints — personalized feed and similar-posts."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.post import Post, PostStatus
from app.models.interaction import Interaction, InteractionType, Bookmark
from app.schemas.post import PostResponse
from app.auth.utils import get_current_user, get_current_user_optional
from app.services.embeddings import embed_text
from app.services.vector_store import (
    ensure_collections,
    get_user_vector,
    search_similar_posts,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


async def _recent_seen_post_ids(user_id: uuid.UUID, db: AsyncSession) -> list[str]:
    """Posts the user has interacted with → exclude from recommendations."""
    liked = (await db.execute(
        select(Interaction.post_id)
        .where(Interaction.user_id == user_id)
        .limit(200)
    )).scalars().all()
    bookmarked = (await db.execute(
        select(Bookmark.post_id).where(Bookmark.user_id == user_id).limit(200)
    )).scalars().all()
    own = (await db.execute(
        select(Post.id).where(Post.author_id == user_id)
    )).scalars().all()
    return [str(pid) for pid in list(liked) + list(bookmarked) + list(own)]


async def _cold_start(db: AsyncSession, limit: int) -> list[Post]:
    """Popular recent posts — used when no vector is available."""
    q = (
        select(Post)
        .where(Post.status == PostStatus.PUBLISHED)
        .order_by(Post.like_count.desc(), Post.published_at.desc())
        .limit(limit)
    )
    return list((await db.execute(q)).scalars().all())


@router.get("/for-you", response_model=list[PostResponse])
async def recommendations_for_you(
    limit: int = Query(20, ge=1, le=50),
    field: str | None = None,
    language: str | None = None,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Personalized feed.

    Strategy:
      1. If user has a vector in Qdrant → ANN search for similar posts.
      2. Else if user has research_interests/bio → embed those on the fly.
      3. Else → fall back to popular posts.
    Results are filtered to exclude posts they've already liked / bookmarked
    or written themselves.
    """
    try:
        ensure_collections()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Qdrant unavailable: %s", exc)
        return await _cold_start(db, limit)

    if current_user is None:
        return await _cold_start(db, limit)

    vector: list[float] | None = get_user_vector(str(current_user.id))

    if vector is None:
        # Embed interests / bio on the fly (no Celery roundtrip needed)
        seed_parts: list[str] = []
        if current_user.research_interests:
            seed_parts.extend(current_user.research_interests)
        if current_user.bio:
            seed_parts.append(current_user.bio)
        seed = " ".join(seed_parts).strip()
        if seed:
            vector = embed_text(seed)

    if vector is None:
        return await _cold_start(db, limit)

    exclude_ids = await _recent_seen_post_ids(current_user.id, db)

    try:
        hits = search_similar_posts(
            vector,
            limit=max(limit * 3, 30),  # over-fetch for rescoring + diversification
            exclude_post_ids=exclude_ids,
            exclude_author_ids=[str(current_user.id)],
            field=field,
            language=language,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Qdrant search failed: %s", exc)
        return await _cold_start(db, limit)

    if not hits:
        return await _cold_start(db, limit)

    # Hydrate posts, then apply multi-signal rescoring + author diversification.
    post_ids = [uuid.UUID(pid) for pid, _, _ in hits]
    result = await db.execute(
        select(Post).where(Post.id.in_(post_ids), Post.status == PostStatus.PUBLISHED)
    )
    posts_by_id = {str(p.id): p for p in result.scalars().all()}

    from app.services.ranker import rank_for_you

    ranked = rank_for_you(hits, posts_by_id)  # [(pid, explanation)]
    ordered = [posts_by_id[pid] for pid, _e in ranked if pid in posts_by_id][:limit]
    expl_by_id = {pid: e for pid, e in ranked}

    responses = []
    for p in ordered:
        r = PostResponse.model_validate(p)
        r.explanation = expl_by_id.get(str(p.id), {})
        responses.append(r)
    return responses


@router.get("/similar/{post_id}", response_model=list[PostResponse])
async def similar_posts(
    post_id: uuid.UUID,
    limit: int = Query(6, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    """Return posts similar to the given post."""
    post_result = await db.execute(select(Post).where(Post.id == post_id))
    post = post_result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    try:
        ensure_collections()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Qdrant unavailable: %s", exc)
        return []

    from app.services.vector_store import get_client, POSTS_COLLECTION

    # Try to reuse the stored vector; if missing, embed title + summary on the fly
    vector: list[float] | None = None
    try:
        points = get_client().retrieve(
            collection_name=POSTS_COLLECTION,
            ids=[str(post.id)],
            with_vectors=True,
        )
        if points:
            v = points[0].vector
            if isinstance(v, dict):
                v = next(iter(v.values()), None)
            vector = list(v) if v else None
    except Exception as exc:  # noqa: BLE001
        logger.warning("Qdrant retrieve failed: %s", exc)

    if vector is None:
        seed = f"{post.title}\n{post.summary or ''}".strip()
        if not seed:
            return []
        vector = embed_text(seed)

    try:
        hits = search_similar_posts(
            vector,
            limit=limit,
            exclude_post_ids=[str(post.id)],
            field=post.field,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Qdrant search failed: %s", exc)
        return []

    if not hits:
        return []

    scores = {pid: float(s) for pid, s, _p in hits}
    post_ids = [uuid.UUID(pid) for pid, _, _ in hits]
    result = await db.execute(
        select(Post).where(Post.id.in_(post_ids), Post.status == PostStatus.PUBLISHED)
    )
    posts_by_id = {str(p.id): p for p in result.scalars().all()}
    ordered = [posts_by_id[pid] for pid, _, _ in hits if pid in posts_by_id]

    responses = []
    for p in ordered:
        r = PostResponse.model_validate(p)
        r.explanation = {"dense": scores.get(str(p.id), 0.0)}
        responses.append(r)
    return responses


@router.get("/author/{author_id}", response_model=list[PostResponse])
async def more_from_author(
    author_id: uuid.UUID,
    exclude_post_id: uuid.UUID | None = None,
    limit: int = Query(4, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    """Other published posts by the same author, newest first."""
    q = (
        select(Post)
        .where(
            Post.author_id == author_id,
            Post.status == PostStatus.PUBLISHED,
        )
        .order_by(Post.published_at.desc())
        .limit(limit + (1 if exclude_post_id else 0))
    )
    posts = list((await db.execute(q)).scalars().all())
    if exclude_post_id:
        posts = [p for p in posts if p.id != exclude_post_id]
    return posts[:limit]


@router.post("/reindex/me", status_code=200)
async def reindex_me(
    current_user: User = Depends(get_current_user),
):
    """Manually trigger a recompute of the caller's interest vector."""
    from app.celery_app import celery_app

    try:
        celery_app.send_task("tasks.update_user_vector", args=[str(current_user.id)])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail="Task broker unavailable") from exc
    return {"status": "queued", "updated_at": datetime.now(timezone.utc).isoformat()}

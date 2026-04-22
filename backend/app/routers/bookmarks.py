import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.post import Post, PostStatus
from app.models.interaction import Bookmark, Interaction, InteractionType
from app.schemas.post import PostListResponse, PostResponse
from app.auth.utils import get_current_user

router = APIRouter(prefix="/api/bookmarks", tags=["bookmarks"])


@router.get("", response_model=PostListResponse)
async def list_my_bookmarks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base_query = (
        select(Post, Bookmark.created_at.label("bookmarked_at"))
        .join(Bookmark, Bookmark.post_id == Post.id)
        .where(
            Bookmark.user_id == current_user.id,
            Post.status == PostStatus.PUBLISHED,
        )
    )

    count_result = await db.execute(
        select(func.count(Bookmark.id))
        .join(Post, Post.id == Bookmark.post_id)
        .where(
            Bookmark.user_id == current_user.id,
            Post.status == PostStatus.PUBLISHED,
        )
    )
    total = count_result.scalar() or 0

    paged_query = (
        base_query.order_by(Bookmark.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(paged_query)
    rows = result.all()
    posts = [row[0] for row in rows]

    responses = [PostResponse.model_validate(p) for p in posts]
    for r in responses:
        r.is_bookmarked = True

    if posts:
        post_ids = [p.id for p in posts]
        like_result = await db.execute(
            select(Interaction.post_id).where(
                Interaction.user_id == current_user.id,
                Interaction.type == InteractionType.LIKE,
                Interaction.post_id.in_(post_ids),
            )
        )
        liked_ids = {row[0] for row in like_result.all()}
        for r in responses:
            r.is_liked = r.id in liked_ids

    return PostListResponse(posts=responses, total=total, page=page, page_size=page_size)

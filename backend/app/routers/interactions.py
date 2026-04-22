import uuid

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.post import Post
from app.models.comment import Comment
from app.models.interaction import Interaction, InteractionType, Follow, Bookmark, Repost
from app.schemas.interaction import CommentCreate, CommentResponse, RepostCreate, BookmarkCreate
from app.auth.utils import get_current_user
from app.celery_app import celery_app

router = APIRouter(prefix="/api/posts", tags=["interactions"])


def _trigger_user_vector(user_id: str) -> None:
    try:
        celery_app.send_task("tasks.update_user_vector", args=[user_id])
    except Exception:  # noqa: BLE001
        pass


# --- Like / Dislike ---

@router.post("/{post_id}/like", status_code=status.HTTP_200_OK)
async def toggle_like(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await _get_post_or_404(post_id, db)
    existing = await db.execute(
        select(Interaction).where(
            Interaction.user_id == current_user.id,
            Interaction.post_id == post_id,
            Interaction.type == InteractionType.LIKE,
        )
    )
    interaction = existing.scalar_one_or_none()
    if interaction:
        await db.delete(interaction)
        post.like_count = max(0, post.like_count - 1)
        return {"liked": False}
    else:
        # Remove dislike if exists
        await _remove_interaction(current_user.id, post_id, InteractionType.DISLIKE, db)
        db.add(Interaction(user_id=current_user.id, post_id=post_id, type=InteractionType.LIKE))
        post.like_count += 1
        _trigger_user_vector(str(current_user.id))
        return {"liked": True}


@router.post("/{post_id}/dislike", status_code=status.HTTP_200_OK)
async def toggle_dislike(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await _get_post_or_404(post_id, db)
    existing = await db.execute(
        select(Interaction).where(
            Interaction.user_id == current_user.id,
            Interaction.post_id == post_id,
            Interaction.type == InteractionType.DISLIKE,
        )
    )
    interaction = existing.scalar_one_or_none()
    if interaction:
        await db.delete(interaction)
        post.dislike_count = max(0, post.dislike_count - 1)
        return {"disliked": False}
    else:
        await _remove_interaction(current_user.id, post_id, InteractionType.LIKE, db)
        db.add(Interaction(user_id=current_user.id, post_id=post_id, type=InteractionType.DISLIKE))
        post.dislike_count += 1
        return {"disliked": True}


# --- Bookmark ---

@router.post("/{post_id}/bookmark", status_code=status.HTTP_200_OK)
async def toggle_bookmark(
    post_id: uuid.UUID,
    data: BookmarkCreate | None = Body(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_post_or_404(post_id, db)
    existing = await db.execute(
        select(Bookmark).where(Bookmark.user_id == current_user.id, Bookmark.post_id == post_id)
    )
    bookmark = existing.scalar_one_or_none()
    if bookmark:
        await db.delete(bookmark)
        return {"bookmarked": False}
    else:
        db.add(Bookmark(
            user_id=current_user.id,
            post_id=post_id,
            folder_name=data.folder_name if data else None,
        ))
        _trigger_user_vector(str(current_user.id))
        return {"bookmarked": True}


# --- Repost ---

@router.post("/{post_id}/repost", status_code=status.HTTP_201_CREATED)
async def create_repost(
    post_id: uuid.UUID,
    data: RepostCreate | None = Body(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await _get_post_or_404(post_id, db)
    existing = await db.execute(
        select(Repost).where(Repost.user_id == current_user.id, Repost.post_id == post_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already reposted")

    db.add(Repost(
        user_id=current_user.id,
        post_id=post_id,
        commentary=data.commentary if data else None,
    ))
    post.repost_count += 1
    return {"reposted": True}


# --- Comments ---

@router.post("/{post_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment(
    post_id: uuid.UUID,
    data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await _get_post_or_404(post_id, db)
    if data.parent_comment_id:
        parent = await db.execute(select(Comment).where(Comment.id == data.parent_comment_id))
        if not parent.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Parent comment not found")

    comment = Comment(
        post_id=post_id,
        author_id=current_user.id,
        parent_comment_id=data.parent_comment_id,
        content=data.content,
    )
    db.add(comment)
    post.comment_count += 1
    await db.flush()
    await db.refresh(comment)
    return comment


@router.get("/{post_id}/comments", response_model=list[CommentResponse])
async def list_comments(post_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await _get_post_or_404(post_id, db)
    result = await db.execute(
        select(Comment)
        .where(Comment.post_id == post_id, Comment.parent_comment_id.is_(None))
        .order_by(Comment.created_at.asc())
    )
    return result.scalars().all()


# --- Helpers ---

async def _get_post_or_404(post_id: uuid.UUID, db: AsyncSession) -> Post:
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


async def _remove_interaction(user_id: uuid.UUID, post_id: uuid.UUID, itype: InteractionType, db: AsyncSession):
    existing = await db.execute(
        select(Interaction).where(
            Interaction.user_id == user_id,
            Interaction.post_id == post_id,
            Interaction.type == itype,
        )
    )
    interaction = existing.scalar_one_or_none()
    if interaction:
        await db.delete(interaction)

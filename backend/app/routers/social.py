import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.post import Post, PostStatus
from app.models.interaction import Follow
from app.schemas.user import UserResponse, UserProfileResponse
from app.schemas.post import PostResponse
from app.auth.utils import get_current_user, get_current_user_optional

router = APIRouter(prefix="/api/users", tags=["social"])


@router.get("/search", response_model=list[UserResponse])
async def search_users(
    q: str = Query(..., min_length=1, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    pattern = f"%{q}%"
    result = await db.execute(
        select(User)
        .where(
            User.is_active == True,  # noqa: E712
            (User.username.ilike(pattern)) | (User.display_name.ilike(pattern)),
        )
        .order_by(User.username.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return result.scalars().all()


@router.post("/{user_id}/follow", status_code=status.HTTP_200_OK)
async def toggle_follow(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    target = await db.execute(select(User).where(User.id == user_id))
    if not target.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.execute(
        select(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.following_id == user_id,
        )
    )
    follow = existing.scalar_one_or_none()
    if follow:
        await db.delete(follow)
        return {"following": False}
    else:
        db.add(Follow(follower_id=current_user.id, following_id=user_id))
        return {"following": True}


@router.get("/{user_id}/followers", response_model=list[UserResponse])
async def list_followers(
    user_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User)
        .join(Follow, Follow.follower_id == User.id)
        .where(Follow.following_id == user_id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return result.scalars().all()


@router.get("/{user_id}/following", response_model=list[UserResponse])
async def list_following(
    user_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User)
        .join(Follow, Follow.following_id == User.id)
        .where(Follow.follower_id == user_id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return result.scalars().all()


@router.get("/{user_id}", response_model=UserResponse)
async def get_user_profile(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/by-username/{username}", response_model=UserProfileResponse)
async def get_profile_by_username(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    followers = (await db.execute(
        select(func.count()).select_from(Follow).where(Follow.following_id == user.id)
    )).scalar() or 0
    following = (await db.execute(
        select(func.count()).select_from(Follow).where(Follow.follower_id == user.id)
    )).scalar() or 0
    posts = (await db.execute(
        select(func.count()).select_from(Post).where(
            Post.author_id == user.id, Post.status == PostStatus.PUBLISHED
        )
    )).scalar() or 0

    is_following = False
    if current_user and current_user.id != user.id:
        exists = (await db.execute(
            select(Follow).where(
                Follow.follower_id == current_user.id,
                Follow.following_id == user.id,
            )
        )).scalar_one_or_none()
        is_following = exists is not None

    return UserProfileResponse(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        bio=user.bio,
        avatar_url=user.avatar_url,
        affiliations=user.affiliations,
        research_interests=user.research_interests,
        created_at=user.created_at,
        follower_count=followers,
        following_count=following,
        post_count=posts,
        is_following=is_following,
    )


@router.get("/by-username/{username}/posts", response_model=list[PostResponse])
async def list_user_posts(
    username: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    user_result = await db.execute(select(User).where(User.username == username))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    result = await db.execute(
        select(Post)
        .where(Post.author_id == user.id, Post.status == PostStatus.PUBLISHED)
        .order_by(Post.published_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return result.scalars().all()

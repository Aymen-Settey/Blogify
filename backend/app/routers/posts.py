from datetime import datetime, timezone
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from slugify import slugify

from app.database import get_db
from app.models.user import User
from app.models.post import Post, PostStatus
from app.models.interaction import Bookmark, Interaction, InteractionType
from app.schemas.post import PostCreate, PostUpdate, PostResponse, PostListResponse
from app.auth.utils import get_current_user, get_current_user_optional
from app.celery_app import celery_app

router = APIRouter(prefix="/api/posts", tags=["posts"])


def _trigger_ml(post_id: str) -> None:
    try:
        celery_app.send_task("tasks.process_post_ml", args=[post_id])
    except Exception:  # noqa: BLE001
        # Broker unavailable — don't fail the API request.
        pass


def _trigger_delete_vector(post_id: str) -> None:
    try:
        celery_app.send_task("tasks.remove_post_vector", args=[post_id])
    except Exception:  # noqa: BLE001
        pass


def generate_slug(title: str) -> str:
    base = slugify(title, max_length=300)
    return f"{base}-{uuid.uuid4().hex[:8]}"


@router.post("", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    data: PostCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = Post(
        author_id=current_user.id,
        title=data.title,
        slug=generate_slug(data.title),
        content=data.content,
        field=data.field,
        sub_field=data.sub_field,
        language=data.language,
        tags=data.tags,
        cover_image_url=data.cover_image_url,
        status=PostStatus(data.status) if data.status else PostStatus.DRAFT,
        published_at=datetime.now(timezone.utc) if data.status == "published" else None,
    )
    db.add(post)
    await db.flush()
    await db.refresh(post)

    if post.status == PostStatus.PUBLISHED:
        _trigger_ml(str(post.id))

    return post


@router.get("", response_model=PostListResponse)
async def list_posts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    field: str | None = None,
    language: str | None = None,
    search: str | None = None,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    query = select(Post).where(Post.status == PostStatus.PUBLISHED)

    if field:
        query = query.where(Post.field == field)
    if language:
        query = query.where(Post.language == language)
    if search:
        query = query.where(
            or_(
                Post.title.ilike(f"%{search}%"),
                Post.tags.any(search),
            )
        )

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    query = query.order_by(Post.published_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    posts = list(result.scalars().all())

    responses = [PostResponse.model_validate(p) for p in posts]

    if current_user and posts:
        post_ids = [p.id for p in posts]
        bm_result = await db.execute(
            select(Bookmark.post_id).where(
                Bookmark.user_id == current_user.id,
                Bookmark.post_id.in_(post_ids),
            )
        )
        bookmarked_ids = {row[0] for row in bm_result.all()}

        like_result = await db.execute(
            select(Interaction.post_id).where(
                Interaction.user_id == current_user.id,
                Interaction.type == InteractionType.LIKE,
                Interaction.post_id.in_(post_ids),
            )
        )
        liked_ids = {row[0] for row in like_result.all()}

        for r in responses:
            r.is_bookmarked = r.id in bookmarked_ids
            r.is_liked = r.id in liked_ids

    return PostListResponse(posts=responses, total=total, page=page, page_size=page_size)


@router.get("/mine", response_model=PostListResponse)
async def my_posts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user's own posts (drafts + published by default, excluding archived)."""
    filters = [Post.author_id == current_user.id]

    if status_filter:
        filters.append(Post.status == PostStatus(status_filter))
    else:
        filters.append(Post.status != PostStatus.ARCHIVED)

    count_q = select(func.count()).select_from(select(Post).where(*filters).subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = (
        select(Post)
        .where(*filters)
        .order_by(Post.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    posts = list(result.scalars().all())

    responses = [PostResponse.model_validate(p) for p in posts]
    return PostListResponse(posts=responses, total=total, page=page, page_size=page_size)


@router.get("/trending", response_model=PostListResponse)
async def trending_posts(
    window_days: int = Query(7, ge=1, le=90),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    field: str | None = None,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Rank posts within the last N days by weighted engagement score."""
    since = datetime.now(timezone.utc) - timedelta(days=window_days)
    score = (
        Post.like_count
        + Post.repost_count * 2
        + Post.comment_count
        + (Post.view_count * 0.1)
    ).label("score")

    base_filter = [
        Post.status == PostStatus.PUBLISHED,
        Post.published_at.is_not(None),
        Post.published_at >= since,
    ]
    if field:
        base_filter.append(Post.field == field)

    count_q = select(func.count()).select_from(
        select(Post).where(*base_filter).subquery()
    )
    total = (await db.execute(count_q)).scalar() or 0

    q = (
        select(Post)
        .where(*base_filter)
        .order_by(score.desc(), Post.published_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    posts = list((await db.execute(q)).scalars().all())

    responses = [PostResponse.model_validate(p) for p in posts]

    if current_user and posts:
        post_ids = [p.id for p in posts]
        bm_result = await db.execute(
            select(Bookmark.post_id).where(
                Bookmark.user_id == current_user.id,
                Bookmark.post_id.in_(post_ids),
            )
        )
        bookmarked_ids = {row[0] for row in bm_result.all()}
        like_result = await db.execute(
            select(Interaction.post_id).where(
                Interaction.user_id == current_user.id,
                Interaction.type == InteractionType.LIKE,
                Interaction.post_id.in_(post_ids),
            )
        )
        liked_ids = {row[0] for row in like_result.all()}
        for r in responses:
            r.is_bookmarked = r.id in bookmarked_ids
            r.is_liked = r.id in liked_ids

    return PostListResponse(posts=responses, total=total, page=page, page_size=page_size)


@router.get("/search/semantic", response_model=PostListResponse)
async def semantic_search_posts(
    q: str = Query(..., min_length=2, max_length=500),
    limit: int = Query(20, ge=1, le=50),
    field: str | None = None,
    language: str | None = None,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Hybrid retrieval over published posts.

    Fuses dense vector search (Qdrant) with BM25 (in-process) via Reciprocal
    Rank Fusion, optionally followed by a cross-encoder reranker. Each
    PostResponse includes ``explanation`` with per-component scores.
    """
    from app.services.embeddings import embed_text
    from app.services.hybrid_search import hybrid_search_posts, rerank_candidates
    from app.services.text_extract import extract_text as _extract_text

    try:
        vector = embed_text(q)
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=503, detail="Embedding model unavailable")

    try:
        fused = hybrid_search_posts(
            q,
            vector,
            limit=limit,
            field=field,
            language=language,
        )
    except Exception:  # noqa: BLE001
        return PostListResponse(posts=[], total=0, page=1, page_size=limit)

    if not fused:
        return PostListResponse(posts=[], total=0, page=1, page_size=limit)

    # Hydrate Post rows preserving fused order.
    try:
        ordered_ids = [uuid.UUID(str(pid)) for pid, _e in fused]
    except (ValueError, TypeError):
        ordered_ids = [pid for pid, _e in fused]
    expl_by_id = {str(pid): e for pid, e in fused}

    rows = (
        await db.execute(
            select(Post).where(
                Post.id.in_(ordered_ids),
                Post.status == PostStatus.PUBLISHED,
            )
        )
    ).scalars().all()
    by_id = {str(p.id): p for p in rows}
    posts = [by_id[str(pid)] for pid in ordered_ids if str(pid) in by_id]

    # Optional cross-encoder rerank over the hydrated candidates.
    try:
        candidates = [
            (
                str(p.id),
                expl_by_id.get(str(p.id), {}),
                f"{p.title or ''}\n{_extract_text(p.content)[:1000]}",
            )
            for p in posts
        ]
        reranked = rerank_candidates(q, candidates)
        order = [pid for pid, _e in reranked]
        expl_by_id = {pid: e for pid, e in reranked}
        posts = [by_id[pid] for pid in order if pid in by_id]
    except Exception:  # noqa: BLE001
        pass  # rerank is best-effort

    responses = []
    for p in posts:
        r = PostResponse.model_validate(p)
        r.explanation = expl_by_id.get(str(p.id), {})
        responses.append(r)

    if current_user and posts:
        post_ids = [p.id for p in posts]
        bm_result = await db.execute(
            select(Bookmark.post_id).where(
                Bookmark.user_id == current_user.id,
                Bookmark.post_id.in_(post_ids),
            )
        )
        bookmarked_ids = {row[0] for row in bm_result.all()}
        like_result = await db.execute(
            select(Interaction.post_id).where(
                Interaction.user_id == current_user.id,
                Interaction.type == InteractionType.LIKE,
                Interaction.post_id.in_(post_ids),
            )
        )
        liked_ids = {row[0] for row in like_result.all()}
        for r in responses:
            r.is_bookmarked = r.id in bookmarked_ids
            r.is_liked = r.id in liked_ids

    return PostListResponse(
        posts=responses, total=len(responses), page=1, page_size=limit
    )


@router.get("/admin/duplicates", response_model=PostListResponse)
async def list_duplicate_posts(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only: list posts flagged as duplicates by the ML pipeline."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    base = select(Post).where(Post.duplicate_of_id.is_not(None))
    total = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar() or 0

    rows = (
        await db.execute(
            base.order_by(Post.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    responses = [PostResponse.model_validate(p) for p in rows]
    return PostListResponse(
        posts=responses, total=total, page=page, page_size=page_size
    )


@router.get("/admin/flagged", response_model=PostListResponse)
async def list_flagged_posts(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only: list posts flagged by the moderation model."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    base = select(Post).where(Post.is_flagged.is_(True))
    total = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar() or 0

    rows = (
        await db.execute(
            base.order_by(Post.toxicity_score.desc().nullslast())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    responses = [PostResponse.model_validate(p) for p in rows]
    return PostListResponse(
        posts=responses, total=total, page=page, page_size=page_size
    )


@router.get("/{slug}", response_model=PostResponse)
async def get_post(
    slug: str,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Post).where(Post.slug == slug))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Increment view count
    post.view_count += 1
    await db.flush()
    await db.refresh(post)

    response = PostResponse.model_validate(post)

    if current_user:
        bm = await db.execute(
            select(Bookmark.id).where(
                Bookmark.user_id == current_user.id,
                Bookmark.post_id == post.id,
            )
        )
        response.is_bookmarked = bm.scalar_one_or_none() is not None

        lk = await db.execute(
            select(Interaction.id).where(
                Interaction.user_id == current_user.id,
                Interaction.post_id == post.id,
                Interaction.type == InteractionType.LIKE,
            )
        )
        response.is_liked = lk.scalar_one_or_none() is not None

    return response


@router.put("/{post_id}", response_model=PostResponse)
async def update_post(
    post_id: uuid.UUID,
    data: PostUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = data.model_dump(exclude_unset=True)

    if "status" in update_data:
        update_data["status"] = PostStatus(update_data["status"])
        if update_data["status"] == PostStatus.PUBLISHED and post.published_at is None:
            update_data["published_at"] = datetime.now(timezone.utc)

    content_or_meta_changed = any(
        k in update_data for k in ("content", "title", "tags", "field", "language", "status")
    )

    for key, value in update_data.items():
        setattr(post, key, value)

    await db.flush()
    await db.refresh(post)

    if content_or_meta_changed:
        _trigger_ml(str(post.id))

    return post


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.author_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    post.status = PostStatus.ARCHIVED
    await db.flush()

    _trigger_delete_vector(str(post.id))

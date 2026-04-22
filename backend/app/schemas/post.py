import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class AuthorSummary(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str | None = None
    avatar_url: str | None = None

    model_config = {"from_attributes": True}


class PostCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    content: dict
    field: str | None = None
    sub_field: str | None = None
    language: str = "en"
    tags: list[str] | None = None
    status: str = "draft"
    cover_image_url: str | None = None


class PostUpdate(BaseModel):
    title: str | None = None
    content: dict | None = None
    field: str | None = None
    sub_field: str | None = None
    language: str | None = None
    tags: list[str] | None = None
    status: str | None = None
    cover_image_url: str | None = None


class PostResponse(BaseModel):
    id: uuid.UUID
    author_id: uuid.UUID
    author: AuthorSummary | None = None
    title: str
    slug: str
    content: dict
    summary: str | None = None
    tags: list[str] | None = None
    auto_tags: list[str] | None = None
    field: str | None = None
    sub_field: str | None = None
    language: str
    status: str
    cover_image_url: str | None = None
    pdf_url: str | None = None
    reading_time_minutes: int | None = None
    like_count: int = 0
    dislike_count: int = 0
    repost_count: int = 0
    comment_count: int = 0
    view_count: int = 0
    is_bookmarked: bool = False
    is_liked: bool = False
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None = None
    # Optional ranking explanation populated by recommendation / search endpoints
    # when `?explain=true` (Phase 2+). Shape is intentionally loose — consumers
    # should only rely on string keys → float values (e.g. {"dense": 0.82, "rerank": 0.71}).
    explanation: dict | None = None

    model_config = {"from_attributes": True}


class PostListResponse(BaseModel):
    posts: list[PostResponse]
    total: int
    page: int
    page_size: int

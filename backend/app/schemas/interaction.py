import uuid
from datetime import datetime
from pydantic import BaseModel, Field

from app.schemas.post import AuthorSummary


class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
    parent_comment_id: uuid.UUID | None = None


class CommentResponse(BaseModel):
    id: uuid.UUID
    post_id: uuid.UUID
    author_id: uuid.UUID
    author: AuthorSummary | None = None
    parent_comment_id: uuid.UUID | None = None
    content: str
    like_count: int = 0
    created_at: datetime
    updated_at: datetime
    replies: list["CommentResponse"] = []

    model_config = {"from_attributes": True}


class RepostCreate(BaseModel):
    commentary: str | None = Field(default=None, max_length=500)


class BookmarkCreate(BaseModel):
    folder_name: str | None = Field(default=None, max_length=100)

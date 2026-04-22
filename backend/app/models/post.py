import uuid
from datetime import datetime

from sqlalchemy import String, Text, Integer, DateTime, ForeignKey, Enum, func, Float, Boolean
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.database import Base


class PostStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    slug: Mapped[str] = mapped_column(String(350), unique=True, nullable=False, index=True)
    content: Mapped[dict] = mapped_column(JSONB, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)  # AI-generated
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    auto_tags: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)  # AI-extracted keywords
    field: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    sub_field: Mapped[str | None] = mapped_column(String(100), nullable=True)
    language: Mapped[str] = mapped_column(String(10), default="en")
    status: Mapped[PostStatus] = mapped_column(Enum(PostStatus), default=PostStatus.DRAFT, index=True)
    cover_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pdf_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    like_count: Mapped[int] = mapped_column(Integer, default=0)
    dislike_count: Mapped[int] = mapped_column(Integer, default=0)
    repost_count: Mapped[int] = mapped_column(Integer, default=0)
    comment_count: Mapped[int] = mapped_column(Integer, default=0)
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Duplicate detection — set by ml_tasks when a near-identical post
    # (cosine > 0.92) by a DIFFERENT author already exists in the index.
    duplicate_of_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("posts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Moderation — soft-flag set by ml_tasks. `toxicity_score` in [0, 1].
    # `is_flagged` is true when score exceeds MODERATION_THRESHOLD.
    toxicity_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    # Relationships
    author = relationship("User", back_populates="posts", lazy="selectin")
    comments = relationship("Comment", back_populates="post", lazy="selectin", cascade="all, delete-orphan")

    @property
    def reading_time_minutes(self) -> int:
        """Estimate reading time from Tiptap JSON content (~200 wpm)."""
        def extract_text(node: dict | list | None) -> str:
            if not node:
                return ""
            if isinstance(node, list):
                return " ".join(extract_text(n) for n in node)
            if isinstance(node, dict):
                text = node.get("text", "") or ""
                return text + " " + extract_text(node.get("content"))
            return ""

        words = len(extract_text(self.content).split())
        return max(1, round(words / 200))

import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, ForeignKey, Enum, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
import enum

from app.database import Base


class NotificationType(str, enum.Enum):
    NEW_FOLLOWER = "new_follower"
    POST_LIKED = "post_liked"
    POST_DISLIKED = "post_disliked"
    POST_COMMENTED = "post_commented"
    POST_REPOSTED = "post_reposted"
    NEW_POST_FROM_FOLLOWED = "new_post_from_followed"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    type: Mapped[NotificationType] = mapped_column(Enum(NotificationType), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

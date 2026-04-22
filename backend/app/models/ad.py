import uuid
from datetime import datetime, date

from sqlalchemy import String, Text, Integer, DateTime, Date, ForeignKey, Enum, func, Index
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.database import Base


class AdStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    ACTIVE = "active"
    PAUSED = "paused"
    REJECTED = "rejected"
    ENDED = "ended"


class AdCampaign(Base):
    __tablename__ = "ad_campaigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    advertiser_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    advertiser_name: Mapped[str] = mapped_column(String(200), nullable=False)

    # Creative
    headline: Mapped[str] = mapped_column(String(140), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cta_label: Mapped[str] = mapped_column(String(40), default="Learn more")
    link: Mapped[str] = mapped_column(String(500), nullable=False)

    # Contextual targeting (privacy-first: matches the post being viewed, not the user)
    target_fields: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    target_keywords: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    target_languages: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)

    # Budget / pacing
    daily_budget_cents: Mapped[int] = mapped_column(Integer, default=0)  # 0 = no cap
    total_budget_cents: Mapped[int] = mapped_column(Integer, default=0)
    spend_cents: Mapped[int] = mapped_column(Integer, default=0)
    cpm_cents: Mapped[int] = mapped_column(Integer, default=100)  # cost per 1000 impressions
    priority: Mapped[int] = mapped_column(Integer, default=0)  # higher = shown first on ties

    # Stats
    impressions: Mapped[int] = mapped_column(Integer, default=0)
    clicks: Mapped[int] = mapped_column(Integer, default=0)

    # Lifecycle
    status: Mapped[AdStatus] = mapped_column(
        Enum(AdStatus), default=AdStatus.DRAFT, index=True
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    advertiser = relationship("User", foreign_keys=[advertiser_id], lazy="selectin")


class AdEventType(str, enum.Enum):
    IMPRESSION = "impression"
    CLICK = "click"


class AdEvent(Base):
    """Append-only log of impressions/clicks.

    Privacy: we store a salted hash of the viewer fingerprint (ip + user-agent),
    never raw IPs.
    """

    __tablename__ = "ad_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ad_campaigns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[AdEventType] = mapped_column(Enum(AdEventType), nullable=False, index=True)
    post_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("posts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    viewer_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    __table_args__ = (
        Index("ix_ad_events_campaign_type_created", "campaign_id", "type", "created_at"),
    )

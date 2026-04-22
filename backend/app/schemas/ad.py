import uuid
from datetime import datetime, date
from pydantic import BaseModel, Field, HttpUrl


class AdCampaignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    advertiser_name: str = Field(min_length=1, max_length=200)
    headline: str = Field(min_length=1, max_length=140)
    body: str = Field(min_length=1, max_length=1000)
    image_url: str | None = None
    cta_label: str = Field(default="Learn more", max_length=40)
    link: str = Field(min_length=1, max_length=500)
    target_fields: list[str] | None = None
    target_keywords: list[str] | None = None
    target_languages: list[str] | None = None
    daily_budget_cents: int = Field(default=0, ge=0)
    total_budget_cents: int = Field(default=0, ge=0)
    cpm_cents: int = Field(default=100, ge=0)
    start_date: date | None = None
    end_date: date | None = None


class AdCampaignUpdate(BaseModel):
    name: str | None = None
    headline: str | None = None
    body: str | None = None
    image_url: str | None = None
    cta_label: str | None = None
    link: str | None = None
    target_fields: list[str] | None = None
    target_keywords: list[str] | None = None
    target_languages: list[str] | None = None
    daily_budget_cents: int | None = None
    total_budget_cents: int | None = None
    cpm_cents: int | None = None
    status: str | None = None
    start_date: date | None = None
    end_date: date | None = None


class AdCampaignResponse(BaseModel):
    id: uuid.UUID
    advertiser_id: uuid.UUID
    name: str
    advertiser_name: str
    headline: str
    body: str
    image_url: str | None = None
    cta_label: str
    link: str
    target_fields: list[str] | None = None
    target_keywords: list[str] | None = None
    target_languages: list[str] | None = None
    daily_budget_cents: int
    total_budget_cents: int
    spend_cents: int
    cpm_cents: int
    priority: int
    impressions: int
    clicks: int
    status: str
    rejection_reason: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AdSlotResponse(BaseModel):
    """Lightweight payload returned to the client for rendering an ad."""
    id: uuid.UUID
    advertiser_name: str
    headline: str
    body: str
    image_url: str | None = None
    cta_label: str
    link: str
    impression_token: str
    score: float = 0.0


class AdModerationAction(BaseModel):
    action: str = Field(pattern=r"^(approve|reject|pause|resume)$")
    reason: str | None = None


class AdStatsResponse(BaseModel):
    campaign_id: uuid.UUID
    impressions: int
    clicks: int
    ctr: float
    spend_cents: int
    last_7_days: list[dict]  # [{date, impressions, clicks}]

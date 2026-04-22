"""Ads: serving, tracking, advertiser CRUD, and admin moderation."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, date, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.post import Post
from app.models.ad import AdCampaign, AdEvent, AdEventType, AdStatus
from app.schemas.ad import (
    AdCampaignCreate,
    AdCampaignUpdate,
    AdCampaignResponse,
    AdSlotResponse,
    AdModerationAction,
    AdStatsResponse,
)
from app.auth.utils import get_current_user, get_current_user_optional
from app.services.ad_matcher import PostContext, rank_campaigns
from app.services.ad_signing import sign_impression, verify_impression, fingerprint_hash
from app.services.vector_store import POSTS_COLLECTION, get_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ads", tags=["ads"])


# ---------------------------------------------------------------------------
# Serving
# ---------------------------------------------------------------------------

@router.get("/serve", response_model=list[AdSlotResponse])
async def serve_ads(
    post_id: uuid.UUID | None = Query(None, description="Post being viewed (for contextual match)"),
    field: str | None = Query(None),
    language: str | None = Query(None),
    limit: int = Query(1, ge=1, le=3),
    db: AsyncSession = Depends(get_db),
):
    """Return up to `limit` ads relevant to the given post context.

    Contextual only — no user targeting. The client passes either a post_id
    or an explicit (field, language) pair.
    """
    ctx_field = field
    ctx_language = language
    ctx_tags: list[str] = []
    ctx_vector: list[float] | None = None

    if post_id is not None:
        result = await db.execute(select(Post).where(Post.id == post_id))
        post = result.scalar_one_or_none()
        if post is not None:
            ctx_field = post.field
            ctx_language = post.language
            ctx_tags = list((post.tags or []) + (post.auto_tags or []))
            # Try to reuse the post's stored embedding
            try:
                pts = get_client().retrieve(
                    collection_name=POSTS_COLLECTION,
                    ids=[str(post.id)],
                    with_vectors=True,
                )
                if pts:
                    v = pts[0].vector
                    if isinstance(v, dict):
                        v = next(iter(v.values()), None)
                    ctx_vector = list(v) if v else None
            except Exception as exc:  # noqa: BLE001
                logger.debug("Qdrant unavailable for ad match: %s", exc)

    # Load all currently-active campaigns
    today = date.today()
    campaigns_q = select(AdCampaign).where(
        AdCampaign.status == AdStatus.ACTIVE,
    )
    campaigns = list((await db.execute(campaigns_q)).scalars().all())

    ctx = PostContext(
        field=ctx_field,
        language=ctx_language,
        tags=ctx_tags,
        vector=ctx_vector,
    )
    ranked = rank_campaigns(campaigns, ctx, top_k=limit)

    slots: list[AdSlotResponse] = []
    for c, score in ranked:
        token = sign_impression(str(c.id), str(post_id) if post_id else None)
        slots.append(
            AdSlotResponse(
                id=c.id,
                advertiser_name=c.advertiser_name,
                headline=c.headline,
                body=c.body,
                image_url=c.image_url,
                cta_label=c.cta_label,
                link=c.link,
                impression_token=token,
                score=round(score, 4),
            )
        )
    return slots


# ---------------------------------------------------------------------------
# Tracking
# ---------------------------------------------------------------------------

@router.post("/impression", status_code=204)
async def record_impression(
    request: Request,
    response: Response,
    token: str = Query(..., description="Signed impression token from /serve"),
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    payload = verify_impression(token)
    if payload is None:
        raise HTTPException(status_code=400, detail="Invalid or expired impression token")

    campaign_id = uuid.UUID(payload["c"])
    post_id = uuid.UUID(payload["p"]) if payload.get("p") else None

    result = await db.execute(select(AdCampaign).where(AdCampaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if campaign is None or campaign.status != AdStatus.ACTIVE:
        # Silently drop — don't leak status info
        response.status_code = status.HTTP_204_NO_CONTENT
        return

    viewer = fingerprint_hash(
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
    )
    db.add(
        AdEvent(
            campaign_id=campaign_id,
            type=AdEventType.IMPRESSION,
            post_id=post_id,
            user_id=current_user.id if current_user else None,
            viewer_hash=viewer,
        )
    )
    campaign.impressions += 1
    if campaign.cpm_cents:
        campaign.spend_cents += max(1, campaign.cpm_cents // 1000)

    # Auto-pause when total budget is exhausted
    if campaign.total_budget_cents and campaign.spend_cents >= campaign.total_budget_cents:
        campaign.status = AdStatus.PAUSED

    response.status_code = status.HTTP_204_NO_CONTENT
    return


@router.get("/click")
async def record_click(
    request: Request,
    token: str = Query(..., description="Signed impression token from /serve"),
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Record a click and 302-redirect to the campaign's destination."""
    payload = verify_impression(token)
    if payload is None:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    campaign_id = uuid.UUID(payload["c"])
    post_id = uuid.UUID(payload["p"]) if payload.get("p") else None

    result = await db.execute(select(AdCampaign).where(AdCampaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")

    viewer = fingerprint_hash(
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
    )
    db.add(
        AdEvent(
            campaign_id=campaign_id,
            type=AdEventType.CLICK,
            post_id=post_id,
            user_id=current_user.id if current_user else None,
            viewer_hash=viewer,
        )
    )
    campaign.clicks += 1

    from fastapi.responses import RedirectResponse

    # Flush so the event is persisted before redirecting
    await db.flush()
    return RedirectResponse(url=campaign.link, status_code=302)


# ---------------------------------------------------------------------------
# Advertiser CRUD ("/api/ads/campaigns")
# ---------------------------------------------------------------------------

@router.post("/campaigns", response_model=AdCampaignResponse, status_code=201)
async def create_campaign(
    data: AdCampaignCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = AdCampaign(
        advertiser_id=current_user.id,
        name=data.name,
        advertiser_name=data.advertiser_name,
        headline=data.headline,
        body=data.body,
        image_url=data.image_url,
        cta_label=data.cta_label,
        link=data.link,
        target_fields=data.target_fields,
        target_keywords=data.target_keywords,
        target_languages=data.target_languages,
        daily_budget_cents=data.daily_budget_cents,
        total_budget_cents=data.total_budget_cents,
        cpm_cents=data.cpm_cents,
        start_date=data.start_date,
        end_date=data.end_date,
        status=AdStatus.PENDING_REVIEW,
    )
    db.add(campaign)
    await db.flush()
    await db.refresh(campaign)
    return campaign


@router.get("/campaigns", response_model=list[AdCampaignResponse])
async def list_my_campaigns(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AdCampaign)
        .where(AdCampaign.advertiser_id == current_user.id)
        .order_by(AdCampaign.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/campaigns/{campaign_id}", response_model=AdCampaignResponse)
async def get_campaign(
    campaign_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_campaign_owned(campaign_id, current_user, db)
    return campaign


@router.put("/campaigns/{campaign_id}", response_model=AdCampaignResponse)
async def update_campaign(
    campaign_id: uuid.UUID,
    data: AdCampaignUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_campaign_owned(campaign_id, current_user, db)
    update_data = data.model_dump(exclude_unset=True)

    # Advertisers can pause/resume their own campaigns, but cannot self-approve.
    if "status" in update_data:
        requested = update_data["status"]
        if requested not in {"paused", "active", "draft", "ended"}:
            raise HTTPException(status_code=400, detail="Invalid status transition")
        if requested == "active" and campaign.status not in {AdStatus.PAUSED, AdStatus.ACTIVE}:
            raise HTTPException(
                status_code=400,
                detail="Campaign must be approved by an admin before activation",
            )
        update_data["status"] = AdStatus(requested)

    for key, value in update_data.items():
        setattr(campaign, key, value)

    # Material creative changes re-enter review
    creative_keys = {"headline", "body", "image_url", "link", "target_fields", "target_keywords"}
    if any(k in update_data for k in creative_keys) and campaign.status == AdStatus.ACTIVE:
        campaign.status = AdStatus.PENDING_REVIEW

    await db.flush()
    await db.refresh(campaign)
    return campaign


@router.delete("/campaigns/{campaign_id}", status_code=204)
async def delete_campaign(
    campaign_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_campaign_owned(campaign_id, current_user, db)
    await db.delete(campaign)


@router.get("/campaigns/{campaign_id}/stats", response_model=AdStatsResponse)
async def campaign_stats(
    campaign_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_campaign_owned(campaign_id, current_user, db)

    # Daily breakdown for the last 7 days
    since = datetime.now(timezone.utc) - timedelta(days=7)
    day = func.date_trunc("day", AdEvent.created_at)
    rows = (
        await db.execute(
            select(
                day.label("d"),
                AdEvent.type,
                func.count().label("n"),
            )
            .where(AdEvent.campaign_id == campaign.id, AdEvent.created_at >= since)
            .group_by(day, AdEvent.type)
            .order_by(day)
        )
    ).all()

    bucket: dict[str, dict[str, int]] = {}
    for d, etype, n in rows:
        key = d.date().isoformat()
        bucket.setdefault(key, {"impressions": 0, "clicks": 0})
        if etype == AdEventType.IMPRESSION:
            bucket[key]["impressions"] = int(n)
        elif etype == AdEventType.CLICK:
            bucket[key]["clicks"] = int(n)

    last_7 = [
        {"date": d, "impressions": v["impressions"], "clicks": v["clicks"]}
        for d, v in sorted(bucket.items())
    ]

    ctr = (campaign.clicks / campaign.impressions) if campaign.impressions else 0.0

    return AdStatsResponse(
        campaign_id=campaign.id,
        impressions=campaign.impressions,
        clicks=campaign.clicks,
        ctr=round(ctr, 4),
        spend_cents=campaign.spend_cents,
        last_7_days=last_7,
    )


# ---------------------------------------------------------------------------
# Admin moderation
# ---------------------------------------------------------------------------

@router.get("/admin/pending", response_model=list[AdCampaignResponse])
async def list_pending_campaigns(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    result = await db.execute(
        select(AdCampaign)
        .where(AdCampaign.status == AdStatus.PENDING_REVIEW)
        .order_by(AdCampaign.created_at.asc())
    )
    return list(result.scalars().all())


@router.post("/admin/campaigns/{campaign_id}/moderate", response_model=AdCampaignResponse)
async def moderate_campaign(
    campaign_id: uuid.UUID,
    action: AdModerationAction,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    result = await db.execute(select(AdCampaign).where(AdCampaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if action.action == "approve":
        campaign.status = AdStatus.ACTIVE
        campaign.rejection_reason = None
    elif action.action == "reject":
        campaign.status = AdStatus.REJECTED
        campaign.rejection_reason = action.reason
    elif action.action == "pause":
        campaign.status = AdStatus.PAUSED
    elif action.action == "resume":
        campaign.status = AdStatus.ACTIVE

    await db.flush()
    await db.refresh(campaign)
    return campaign


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_campaign_owned(
    campaign_id: uuid.UUID, current_user: User, db: AsyncSession
) -> AdCampaign:
    result = await db.execute(select(AdCampaign).where(AdCampaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.advertiser_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    return campaign


def _require_admin(user: User) -> None:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

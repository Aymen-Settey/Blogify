"""Contextual ad targeting.

Given a post (its field, tags, and embedding), rank active campaigns by how
well they match. Privacy-first: no user-level targeting, only post context.

Scoring (all normalized to [0, 1]):
- field match          : +0.35
- keyword overlap      : +0.25 * overlap_ratio
- language match       : +0.10
- semantic similarity  : +0.20 * cosine(campaign_embed, post_embed)
- recency / priority   : +0.10 * min(priority / 10, 1)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date

import numpy as np

from app.models.ad import AdCampaign, AdStatus
from app.services.embeddings import embed_text

logger = logging.getLogger(__name__)


@dataclass
class PostContext:
    field: str | None
    language: str | None
    tags: list[str]
    vector: list[float] | None  # post embedding (may be None if ML hasn't run yet)


def _tokens(values: list[str] | None) -> set[str]:
    if not values:
        return set()
    out: set[str] = set()
    for v in values:
        for tok in v.lower().replace("-", " ").split():
            if len(tok) >= 2:
                out.add(tok)
    return out


def _cosine(a: list[float], b: list[float]) -> float:
    va = np.asarray(a, dtype=np.float32)
    vb = np.asarray(b, dtype=np.float32)
    na = float(np.linalg.norm(va))
    nb = float(np.linalg.norm(vb))
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(va, vb) / (na * nb))


def _campaign_embedding_text(c: AdCampaign) -> str:
    parts = [c.headline, c.body]
    if c.target_keywords:
        parts.append(" ".join(c.target_keywords))
    if c.target_fields:
        parts.append(" ".join(c.target_fields))
    return " ".join(p for p in parts if p).strip()


def is_campaign_servable(c: AdCampaign, today: date) -> bool:
    """Basic eligibility: status, dates, budget."""
    if c.status != AdStatus.ACTIVE:
        return False
    if c.start_date and today < c.start_date:
        return False
    if c.end_date and today > c.end_date:
        return False
    if c.total_budget_cents and c.spend_cents >= c.total_budget_cents:
        return False
    return True


def score_campaign(campaign: AdCampaign, ctx: PostContext) -> float:
    """Return a relevance score in ~[0, 1.1]."""
    score = 0.0

    # Field
    if campaign.target_fields and ctx.field and ctx.field in campaign.target_fields:
        score += 0.35
    elif not campaign.target_fields:
        # Untargeted campaigns get a small baseline
        score += 0.10

    # Keyword overlap
    cam_kw = _tokens(campaign.target_keywords)
    post_kw = _tokens(ctx.tags)
    if cam_kw and post_kw:
        overlap = len(cam_kw & post_kw) / max(1, len(cam_kw))
        score += 0.25 * overlap

    # Language
    if campaign.target_languages and ctx.language and ctx.language in campaign.target_languages:
        score += 0.10
    elif not campaign.target_languages:
        score += 0.05

    # Semantic similarity (post embedding vs campaign text embedding)
    if ctx.vector:
        try:
            camp_vec = embed_text(_campaign_embedding_text(campaign))
            sim = max(0.0, _cosine(ctx.vector, camp_vec))
            score += 0.20 * sim
        except Exception as exc:  # noqa: BLE001
            logger.debug("Campaign embed failed for %s: %s", campaign.id, exc)

    # Priority / pacing nudge
    score += 0.10 * min(max(campaign.priority, 0) / 10.0, 1.0)

    return score


def rank_campaigns(
    campaigns: list[AdCampaign],
    ctx: PostContext,
    top_k: int = 3,
    min_score: float = 0.15,
) -> list[tuple[AdCampaign, float]]:
    today = date.today()
    scored: list[tuple[AdCampaign, float]] = []
    for c in campaigns:
        if not is_campaign_servable(c, today):
            continue
        s = score_campaign(c, ctx)
        if s >= min_score:
            scored.append((c, s))
    scored.sort(key=lambda pair: (pair[1], pair[0].priority), reverse=True)
    return scored[:top_k]

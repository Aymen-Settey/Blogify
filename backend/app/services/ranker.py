"""Multi-signal ranking for the personalized feed.

Takes the dense-search candidates and rescores them combining:
  - ``dense``     — cosine similarity from the user's interest vector
  - ``freshness`` — exponential decay on ``published_at``
  - ``quality``   — log-scaled engagement (likes + comments + reposts)
  - ``diversity`` — MMR-style penalty so one author / one topic can't flood

The final score is ``WEIGHTS.dense * dense + WEIGHTS.fresh * fresh +
WEIGHTS.quality * quality`` with an MMR pass at the end. We also set
``explanation`` on each post so the UI can show the top signals.
"""
from __future__ import annotations

import math
import time
from dataclasses import dataclass

# Half-life (days) for the freshness decay. A 30-day-old post scores ~0.5.
FRESHNESS_HALFLIFE_DAYS = 30.0


@dataclass(frozen=True)
class Weights:
    dense: float = 1.0
    fresh: float = 0.25
    quality: float = 0.20


DEFAULT_WEIGHTS = Weights()


def _freshness(published_at_ts: int, now: float) -> float:
    """Exponential decay → score in (0, 1]."""
    if not published_at_ts:
        return 0.0
    age_days = max(0.0, (now - published_at_ts) / 86400.0)
    return 0.5 ** (age_days / FRESHNESS_HALFLIFE_DAYS)


def _quality(like_count: int, comment_count: int, repost_count: int) -> float:
    """Log-scaled engagement → score in [0, ~1]."""
    engagement = (like_count or 0) + 2 * (repost_count or 0) + (comment_count or 0)
    if engagement <= 0:
        return 0.0
    return min(1.0, math.log1p(engagement) / math.log1p(100))


def _mmr_reorder(
    items: list[tuple[str, float, dict]],
    lambda_: float = 0.75,
    author_penalty: float = 0.2,
) -> list[tuple[str, float, dict]]:
    """Light author-diversification pass (greedy MMR-style).

    Each time we pick the next item, we penalize candidates from already-picked
    authors by ``author_penalty``. Items are (post_id, base_score, extras).
    """
    if not items:
        return items
    remaining = list(items)
    chosen: list[tuple[str, float, dict]] = []
    seen_authors: dict[str, int] = {}

    while remaining:
        best_idx = 0
        best_score = float("-inf")
        for i, (_pid, score, extras) in enumerate(remaining):
            author = str(extras.get("author_id") or "")
            penalty = author_penalty * seen_authors.get(author, 0)
            adjusted = lambda_ * score - penalty
            if adjusted > best_score:
                best_score = adjusted
                best_idx = i
        picked = remaining.pop(best_idx)
        chosen.append(picked)
        author = str(picked[2].get("author_id") or "")
        if author:
            seen_authors[author] = seen_authors.get(author, 0) + 1
    return chosen


def rank_for_you(
    candidates: list[tuple[str, float, dict]],
    posts_by_id: dict[str, object],
    weights: Weights = DEFAULT_WEIGHTS,
) -> list[tuple[str, dict]]:
    """Rescore + diversify. Returns [(post_id, explanation)].

    ``candidates`` — (post_id, dense_score, qdrant_payload) as returned by
    ``search_similar_posts``. ``posts_by_id`` provides DB counts and timestamps.
    """
    now = time.time()
    rescored: list[tuple[str, float, dict]] = []

    for pid, dense_score, payload in candidates:
        post = posts_by_id.get(pid)
        if post is None:
            continue

        published_ts = int(payload.get("published_at_ts") or 0)
        if not published_ts and getattr(post, "published_at", None):
            published_ts = int(post.published_at.timestamp())  # type: ignore[attr-defined]

        fresh = _freshness(published_ts, now)
        quality = _quality(
            getattr(post, "like_count", 0) or 0,
            getattr(post, "comment_count", 0) or 0,
            getattr(post, "repost_count", 0) or 0,
        )
        combined = (
            weights.dense * float(dense_score)
            + weights.fresh * fresh
            + weights.quality * quality
        )
        extras = dict(payload)
        extras.update(
            {
                "dense": float(dense_score),
                "freshness": fresh,
                "quality": quality,
                "score": combined,
            }
        )
        rescored.append((pid, combined, extras))

    rescored.sort(key=lambda x: x[1], reverse=True)
    reordered = _mmr_reorder(rescored)

    out: list[tuple[str, dict]] = []
    for pid, _score, extras in reordered:
        out.append(
            (
                pid,
                {
                    "dense": round(extras["dense"], 4),
                    "freshness": round(extras["freshness"], 4),
                    "quality": round(extras["quality"], 4),
                    "score": round(extras["score"], 4),
                },
            )
        )
    return out

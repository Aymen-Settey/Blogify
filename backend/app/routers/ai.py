"""AI-assist endpoints — on-demand LLM features for authors and readers.

Endpoints:
    POST /api/ai/draft          — suggest title/excerpt/tags from raw content
    POST /api/ai/ask/{post_id}  — ask a question grounded in the post content
    GET  /api/ai/health         — whether the local LLM is reachable
"""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.utils import get_current_user
from app.database import get_db
from app.models.post import Post, PostStatus
from app.models.user import User
from app.services.llm_client import LLMError, complete, is_available
from app.services.text_extract import extract_text

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai", tags=["ai"])

# --- schemas -------------------------------------------------------------------


class DraftRequest(BaseModel):
    content: str = Field(..., min_length=50, max_length=20000)
    current_title: str | None = None


class DraftResponse(BaseModel):
    title: str | None
    excerpt: str | None
    tags: list[str]


class AskRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=500)


class AskResponse(BaseModel):
    answer: str
    grounded: bool


# --- helpers -------------------------------------------------------------------


def _parse_draft(raw: str) -> DraftResponse:
    """Parse the loose LLM output into title / excerpt / tags.

    We use a simple line-prefix protocol rather than JSON because small models
    are unreliable at pure JSON generation.
    """
    title: str | None = None
    excerpt: str | None = None
    tags: list[str] = []

    for line in raw.splitlines():
        low = line.lower().strip()
        if low.startswith("title:"):
            title = line.split(":", 1)[1].strip().strip('"').strip("'") or None
        elif low.startswith("excerpt:") or low.startswith("summary:"):
            excerpt = line.split(":", 1)[1].strip().strip('"').strip("'") or None
        elif low.startswith("tags:"):
            body = line.split(":", 1)[1]
            tags = [
                t.strip().lstrip("#").strip()
                for t in body.replace(";", ",").split(",")
                if t.strip()
            ][:6]

    if title:
        title = title[:200]
    if excerpt:
        excerpt = excerpt[:400]
    return DraftResponse(title=title, excerpt=excerpt, tags=tags)


# --- endpoints -----------------------------------------------------------------


@router.get("/health")
async def ai_health():
    """Lightweight probe for the local LLM backend."""
    ok = await is_available()
    return {"ollama": "up" if ok else "down"}


@router.post("/draft", response_model=DraftResponse)
async def draft_from_content(
    req: DraftRequest,
    current_user: User = Depends(get_current_user),
):
    """Suggest a title, excerpt and tags from draft content."""
    snippet = req.content.strip()[:4000]
    current = (req.current_title or "").strip()
    system = (
        "You help authors polish blog posts. Respond in English with exactly "
        "three lines in this format:\n"
        "Title: <concise, under 80 chars>\n"
        "Excerpt: <one sentence, under 200 chars>\n"
        "Tags: <comma-separated, 3-6 lowercase tags>"
    )
    prompt = (
        f"Current working title: {current or '(none)'}\n"
        f"Content:\n{snippet}\n\n"
        "Suggest title, excerpt and tags."
    )
    try:
        raw = await complete(prompt, system=system, max_tokens=200, temperature=0.4)
    except LLMError as exc:
        raise HTTPException(status_code=503, detail=f"LLM unavailable: {exc}")

    return _parse_draft(raw)


@router.post("/ask/{post_id}", response_model=AskResponse)
async def ask_post(
    post_id: uuid.UUID,
    req: AskRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Answer a reader question using only the post's content as grounding."""
    post = (
        await db.execute(select(Post).where(Post.id == post_id))
    ).scalar_one_or_none()
    if not post or post.status != PostStatus.PUBLISHED:
        raise HTTPException(status_code=404, detail="Post not found")

    body = extract_text(post.content).strip()
    if not body:
        return AskResponse(
            answer="This post has no readable text to answer from.",
            grounded=False,
        )

    # Truncate context to fit the model's window comfortably.
    context = body[:4000]
    system = (
        "You answer questions using ONLY the provided article. "
        "If the article does not contain the answer, say exactly: "
        '"The article does not cover this." Keep answers under 4 sentences.'
    )
    prompt = (
        f"Article title: {post.title}\n\n"
        f"Article:\n{context}\n\n"
        f"Question: {req.question}\n\n"
        "Answer:"
    )

    try:
        answer = await complete(prompt, system=system, max_tokens=220, temperature=0.2)
    except LLMError as exc:
        raise HTTPException(status_code=503, detail=f"LLM unavailable: {exc}")

    grounded = "does not cover this" not in answer.lower()
    return AskResponse(answer=answer or "(no answer)", grounded=grounded)

"""
Content Library API.

Content Library API.

New content lives in content_outputs. Legacy interview columns are returned only
when an interview has no content_outputs rows yet, so old sessions still open.
"""

import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth_config import current_active_user
from app.db.database import get_async_session
from app.db.models import ContentOutput, Interview

router = APIRouter(prefix="/posts", tags=["posts"])

Platform = Literal["linkedin", "x", "twitter", "newsletter"]

# Field mapping keeps the Interview column layout hidden from callers.
_CONTENT_COL = {
    "linkedin":   "linkedin_post",
    "twitter":    "twitter_thread",
    "newsletter": "newsletter_post",
}
_STATUS_COL = {
    "linkedin":   "linkedin_status",
    "twitter":    "twitter_status",
    "newsletter": "newsletter_status",
}
_UPDATED_COL = {
    "linkedin":   "linkedin_updated_at",
    "twitter":    "twitter_updated_at",
    "newsletter": "newsletter_updated_at",
}


class PostOut(BaseModel):
    output_id: Optional[uuid.UUID] = None
    interview_id: uuid.UUID
    platform: Platform
    content_type: Optional[str] = None
    title: Optional[str] = None
    content: str
    status: str
    topic: Optional[str]
    created_at: datetime
    updated_at: datetime


class PostUpdate(BaseModel):
    content: Optional[str] = None
    status: Optional[Literal["draft", "generated", "published", "archived"]] = None


def _row_for_platform(interview: Interview, platform: Platform) -> Optional[PostOut]:
    legacy_platform = "twitter" if platform == "x" else platform
    if legacy_platform not in _CONTENT_COL:
        return None

    content = getattr(interview, _CONTENT_COL[legacy_platform])
    if not content:
        return None
    status = getattr(interview, _STATUS_COL[legacy_platform]) or "generated"
    if status == "archived":
        return None
    updated = getattr(interview, _UPDATED_COL[legacy_platform]) or interview.updated_at
    return PostOut(
        interview_id=interview.id,
        platform="x" if legacy_platform == "twitter" else legacy_platform,
        content_type={
            "linkedin": "linkedin_post",
            "twitter": "x_thread",
            "newsletter": "newsletter_issue",
        }[legacy_platform],
        content=content,
        status=status,
        topic=interview.topic,
        created_at=interview.created_at,
        updated_at=updated,
    )


def _row_for_output(output: ContentOutput, topic: Optional[str]) -> Optional[PostOut]:
    if output.status == "archived":
        return None
    return PostOut(
        output_id=output.id,
        interview_id=output.interview_id,
        platform=output.platform,  # type: ignore[arg-type]
        content_type=output.content_type,
        title=output.title,
        content=output.edited_content or output.raw_content,
        status=output.status,
        topic=topic,
        created_at=output.created_at,
        updated_at=output.updated_at,
    )


@router.get("", response_model=list[PostOut])
async def list_posts(
    platform: Optional[Platform] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    user=Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Flat list of posts across every interview owned by the current user.
    Filters: platform, status (draft|generated|published), search (topic or content).
    Archived posts are hidden.
    """
    requested_platform = "x" if platform == "twitter" else platform
    needle = search.lower() if search else None

    output_stmt = (
        select(ContentOutput, Interview.topic)
        .join(Interview, Interview.id == ContentOutput.interview_id)
        .where(ContentOutput.user_id == user.id, ContentOutput.status != "archived")
        .order_by(ContentOutput.updated_at.desc())
    )
    rows: list[PostOut] = []
    result = await session.execute(output_stmt)
    output_interview_ids: set[uuid.UUID] = set()
    for output, topic in result.all():
        output_interview_ids.add(output.interview_id)
        row = _row_for_output(output, topic)
        if not row:
            continue
        if requested_platform and row.platform != requested_platform:
            continue
        if status and row.status != status:
            continue
        if needle:
            hay = f"{row.topic or ''} {row.title or ''} {row.content}".lower()
            if needle not in hay:
                continue
        rows.append(row)

    legacy_stmt = (
        select(Interview)
        .where(Interview.user_id == user.id)
        .order_by(Interview.updated_at.desc())
    )
    legacy_result = await session.execute(legacy_stmt)
    platforms: list[Platform] = [requested_platform] if requested_platform else ["linkedin", "x", "newsletter"]
    for interview in legacy_result.scalars().all():
        if interview.id in output_interview_ids:
            continue
        for legacy_platform in platforms:
            row = _row_for_platform(interview, legacy_platform)
            if not row:
                continue
            if status and row.status != status:
                continue
            if needle:
                hay = f"{row.topic or ''} {row.content}".lower()
                if needle not in hay:
                    continue
            rows.append(row)

    rows.sort(key=lambda r: r.updated_at, reverse=True)
    return rows


@router.patch("/{interview_id}/{platform}", response_model=PostOut)
async def update_post(
    interview_id: uuid.UUID,
    platform: Platform,
    data: PostUpdate,
    user=Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Edit a single post's content or transition its status."""
    stmt = select(Interview).where(Interview.id == interview_id, Interview.user_id == user.id)
    result = await session.execute(stmt)
    interview = result.scalars().first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    updates = data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "content" in updates:
        setattr(interview, _CONTENT_COL[platform], updates["content"])
    if "status" in updates:
        setattr(interview, _STATUS_COL[platform], updates["status"])
    setattr(interview, _UPDATED_COL[platform], datetime.now(timezone.utc))

    await session.commit()
    await session.refresh(interview)

    row = _row_for_platform(interview, platform)
    if not row:
        # Happens if the update set content to empty or status to archived
        raise HTTPException(status_code=404, detail="Post no longer exists after update")
    return row


@router.delete("/{interview_id}/{platform}", status_code=204)
async def delete_post(
    interview_id: uuid.UUID,
    platform: Platform,
    user=Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Soft-delete: nulls the content column and marks the platform as 'archived'
    so it disappears from the library but the parent interview/transcript stays.
    """
    stmt = select(Interview).where(Interview.id == interview_id, Interview.user_id == user.id)
    result = await session.execute(stmt)
    interview = result.scalars().first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    setattr(interview, _CONTENT_COL[platform], None)
    setattr(interview, _STATUS_COL[platform], "archived")
    setattr(interview, _UPDATED_COL[platform], datetime.now(timezone.utc))

    await session.commit()
    return None

import uuid
from typing import Optional, List, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime, timezone

from app.db.database import get_async_session
from app.db.models import Interview
from app.auth.auth_config import current_active_user

router = APIRouter(prefix="/interviews", tags=["interviews"])


class InterviewCreate(BaseModel):
    topic: Optional[str] = None
    outline: Optional[str] = None


class InterviewUpdate(BaseModel):
    topic: Optional[str] = None
    outline: Optional[str] = None
    raw_transcript: Optional[str] = None
    status: Optional[str] = None
    duration_seconds: Optional[int] = None
    linkedin_post: Optional[str] = None
    twitter_thread: Optional[str] = None
    newsletter_post: Optional[str] = None


class InterviewAutosave(BaseModel):
    """Fast heartbeat write during an active session."""
    raw_transcript: Optional[str] = None
    duration_seconds: Optional[int] = None
    resume_state: Optional[dict] = None


class InterviewFinalizeDraft(BaseModel):
    """Final flush when the user leaves the call without generating content."""
    raw_transcript: Optional[str] = None
    duration_seconds: Optional[int] = None
    resume_state: Optional[dict] = None


class InterviewOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    topic: Optional[str]
    outline: Optional[str]
    raw_transcript: Optional[str]
    status: str
    duration_seconds: Optional[int]
    linkedin_post: Optional[str]
    twitter_thread: Optional[str]
    newsletter_post: Optional[str]
    linkedin_status: Optional[str] = None
    twitter_status: Optional[str] = None
    newsletter_status: Optional[str] = None
    linkedin_updated_at: Optional[datetime] = None
    twitter_updated_at: Optional[datetime] = None
    newsletter_updated_at: Optional[datetime] = None
    last_saved_at: Optional[datetime] = None
    resume_state: Optional[Any] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


async def _load_owned(
    interview_id: uuid.UUID, user_id: uuid.UUID, session: AsyncSession
) -> Interview:
    stmt = select(Interview).where(Interview.id == interview_id, Interview.user_id == user_id)
    result = await session.execute(stmt)
    interview = result.scalars().first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return interview


@router.get("", response_model=List[InterviewOut])
async def list_interviews(
    user=Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Fetch all interviews for the current logged-in user."""
    stmt = select(Interview).where(Interview.user_id == user.id).order_by(Interview.created_at.desc())
    result = await session.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=InterviewOut)
async def create_interview(
    data: InterviewCreate,
    user=Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Create a new interview session."""
    interview = Interview(
        id=uuid.uuid4(),
        user_id=user.id,
        topic=data.topic,
        outline=data.outline,
        status="STARTED",
    )
    session.add(interview)
    await session.commit()
    await session.refresh(interview)
    return interview


@router.get("/{interview_id}", response_model=InterviewOut)
async def get_interview(
    interview_id: uuid.UUID,
    user=Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Fetch a single interview by ID (must belong to current user)."""
    return await _load_owned(interview_id, user.id, session)


@router.patch("/{interview_id}", response_model=InterviewOut)
async def update_interview(
    interview_id: uuid.UUID,
    data: InterviewUpdate,
    user=Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Update interview fields (transcript, status, generated content, etc.)."""
    interview = await _load_owned(interview_id, user.id, session)

    update_fields = data.model_dump(exclude_unset=True)
    now = datetime.now(timezone.utc)
    # Stamp per-platform updated_at whenever content is touched via PATCH
    if "linkedin_post" in update_fields:
        interview.linkedin_updated_at = now
        if update_fields["linkedin_post"] and not interview.linkedin_status:
            interview.linkedin_status = "generated"
    if "twitter_thread" in update_fields:
        interview.twitter_updated_at = now
        if update_fields["twitter_thread"] and not interview.twitter_status:
            interview.twitter_status = "generated"
    if "newsletter_post" in update_fields:
        interview.newsletter_updated_at = now
        if update_fields["newsletter_post"] and not interview.newsletter_status:
            interview.newsletter_status = "generated"

    for field, value in update_fields.items():
        setattr(interview, field, value)

    await session.commit()
    await session.refresh(interview)
    return interview


@router.post("/{interview_id}/autosave", response_model=InterviewOut)
async def autosave_interview(
    interview_id: uuid.UUID,
    data: InterviewAutosave,
    user=Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Lightweight heartbeat called ~every 10s by the interview page.
    Updates transcript/duration/resume_state + last_saved_at without changing status.
    """
    interview = await _load_owned(interview_id, user.id, session)

    update_fields = data.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(interview, field, value)
    interview.last_saved_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(interview)
    return interview


@router.post("/{interview_id}/finalize-draft", response_model=InterviewOut)
async def finalize_draft(
    interview_id: uuid.UUID,
    data: InterviewFinalizeDraft,
    user=Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Mark an interrupted interview as a resumable DRAFT.
    Called from beforeunload/sendBeacon or an explicit "Save & Exit" click.
    Idempotent: if already COMPLETED or FAILED, leaves status alone.
    """
    interview = await _load_owned(interview_id, user.id, session)

    update_fields = data.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        setattr(interview, field, value)
    interview.last_saved_at = datetime.now(timezone.utc)

    # Only transition from in-flight states. Completed/Failed are terminal.
    if interview.status not in ("COMPLETED", "FAILED"):
        interview.status = "DRAFT"

    await session.commit()
    await session.refresh(interview)
    return interview

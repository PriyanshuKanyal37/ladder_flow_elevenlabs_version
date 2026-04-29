import json
from datetime import datetime, timezone, timedelta
import uuid
import logging

from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
import requests

from app.auth.auth_config import current_active_user
from app.core.config import settings
from app.db.database import get_async_session
from app.db.models import User, UserProfile, Interview
from app.schemas.requests import TopicRequest, AgentDispatchRequest, ExtractRequest
from app.services import memory_pack_builder, memory_extractor
from app.services.agent_config import build_agent_config
from app.services.rate_limiter import check_rate_limit

router = APIRouter()
logger = logging.getLogger(__name__)

VOICE_START_COOLDOWN_SECONDS = 45
ACTIVE_SESSION_BLOCK_SECONDS = 120


def _safe_load_outline(outline: str | None) -> dict:
    if not outline:
        return {}
    try:
        parsed = json.loads(outline)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}



def _assert_elevenlabs_config() -> None:
    if not settings.ELEVENLABS_API_KEY or not settings.ELEVENLABS_AGENT_ID:
        raise HTTPException(
            status_code=500,
            detail="ElevenLabs agent is not configured on the backend",
        )


def _get_elevenlabs_signed_url(agent_id: str) -> str:
    """
    Server-side signed URL generation for private/authenticated ElevenAgents sessions.
    """
    response = requests.get(
        "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url",
        params={"agent_id": agent_id},
        headers={"xi-api-key": settings.ELEVENLABS_API_KEY},
        timeout=15,
    )
    if not response.ok:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to obtain ElevenLabs signed URL ({response.status_code})",
        )
    payload = response.json()
    signed_url = payload.get("signed_url")
    if not signed_url:
        raise HTTPException(status_code=502, detail="ElevenLabs did not return signed_url")
    return signed_url


async def _lock_user_voice_start(session: AsyncSession, user_id: uuid.UUID) -> None:
    """
    Serialize voice starts per user. Different users get different locks, so this
    does not reduce multi-user concurrency.
    """
    await session.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:lock_key))"),
        {"lock_key": f"voice_start:{user_id}"},
    )


def _last_activity_at(interview: Interview) -> datetime:
    return interview.last_saved_at or interview.updated_at or interview.created_at


async def _assert_voice_start_allowed(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> None:
    """
    Prevent duplicate paid ElevenLabs starts from the same user while a session
    is already starting/active. This is intentionally scoped per user.
    """
    now = datetime.now(timezone.utc)
    active_cutoff = now - timedelta(seconds=ACTIVE_SESSION_BLOCK_SECONDS)

    stmt = (
        select(Interview)
        .where(Interview.user_id == user_id, Interview.status == "INTERVIEWING")
        .order_by(Interview.updated_at.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    active = result.scalars().first()

    if not active:
        return

    last_activity = _last_activity_at(active)
    if last_activity and last_activity >= active_cutoff:
        retry_after = max(
            1,
            ACTIVE_SESSION_BLOCK_SECONDS - int((now - last_activity).total_seconds()),
        )
        raise HTTPException(
            status_code=409,
            detail={
                "code": "voice_session_already_active",
                "message": "A voice session is already active for this user.",
                "interview_id": str(active.id),
                "retry_after_seconds": retry_after,
            },
            headers={"Retry-After": str(retry_after)},
        )


@router.post("/agent-config")
async def agent_config(
    req: TopicRequest,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Build interview config and persist an interview row before voice starts.
    Dispatch is intentionally separated into /agent-dispatch to avoid race conditions.
    """
    check_rate_limit(user.id, "voice_start")
    _assert_elevenlabs_config()
    await _lock_user_voice_start(session, user.id)
    await _assert_voice_start_allowed(session, user.id)

    stmt = select(UserProfile).where(UserProfile.user_id == user.id)
    result = await session.execute(stmt)
    profile = result.scalars().first()

    topic_title = req.get_topic_title()
    resolved_user_name = req.get_user_name()
    if resolved_user_name == "Guest" and user.full_name:
        resolved_user_name = user.full_name

    try:
        memory_pack = await memory_pack_builder.build(
            session=session,
            user_id=str(user.id),
            topic=topic_title,
        )
    except Exception as exc:
        # Voice session must still start even if memory systems are degraded.
        logger.warning("Memory pack build failed, continuing without memory context: %s", exc)
        memory_pack = ""

    config = build_agent_config(
        topic_title=topic_title,
        global_context=req.global_context or "",
        why_this_matters=req.why_this_matters or "",
        key_questions=req.key_questions or [],
        user_name=resolved_user_name,
        full_name=user.full_name,
        bio=profile.bio if profile else None,
        niche=profile.niche if profile else None,
        industry=profile.industry if profile else None,
        target_audience=profile.target_audience if profile else None,
        icp=profile.icp if profile else None,
        offer=profile.offer if profile else None,
        pain_solved=profile.pain_solved if profile else None,
        differentiator=profile.differentiator if profile else None,
        content_tone=profile.content_tone if profile else None,
        tone=profile.tone if profile else None,
        proof_points=profile.proof_points if profile else None,
        primary_goal=profile.primary_goal if profile else None,
        key_themes=profile.key_themes if profile else None,
        platforms=profile.platforms if profile else None,
        memory_pack=memory_pack,
    )

    interview = Interview(
        user_id=user.id,
        topic=config["topicTitle"],
        status="INTERVIEWING",
        outline=json.dumps(
            {
                "path": "path_c_elevenagents",
                "provider": "elevenlabs",
                "dispatch_sent_at": None,
                "dispatch_metadata": {
                    "system_prompt": config["systemPrompt"],
                    "greeting": config["greeting"],
                    "user_name": config["userName"],
                    "topic_title": config["topicTitle"],
                },
                # Persisted so /agent-config/resume can reconstruct the frontend
                # research-context sessionStorage blob for the interview page.
                "research_context": {
                    "title": config["topicTitle"],
                    "deep_context": req.global_context or "",
                    "why_this_matters": req.why_this_matters or "",
                    "key_questions": req.key_questions or [],
                    "discussion_points": req.key_questions or [],
                    "key_insights": [req.why_this_matters] if req.why_this_matters else [],
                },
            }
        ),
    )
    session.add(interview)
    await session.commit()
    await session.refresh(interview)

    signed_url = _get_elevenlabs_signed_url(settings.ELEVENLABS_AGENT_ID)
    overrides = {
        "agent": {
            "prompt": {"prompt": config["systemPrompt"]},
            "firstMessage": config["greeting"],
        }
    }

    return {
        "provider": "elevenlabs",
        "agentId": settings.ELEVENLABS_AGENT_ID,
        "signedUrl": signed_url,
        "overrides": overrides,
        "topicTitle": config["topicTitle"],
        "userName": config["userName"],
        "greeting": config["greeting"],
        "interviewId": str(interview.id),
    }


@router.post("/agent-dispatch")
async def agent_dispatch():
    """ElevenAgents handles session setup client-side; no server dispatch needed."""
    return {"status": "not_required", "roomName": ""}


@router.post("/agent-config/resume")
async def agent_config_resume(
    req: AgentDispatchRequest,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Resume an existing DRAFT interview.

    Loads the original research context + prior transcript from the interview
    row, re-runs the prompt pipeline with a PRIOR_CONVERSATION block, mints a
    fresh LiveKit room + token, and flips the status back to INTERVIEWING.
    The Interview row is reused — so resumed sessions end up in one continuous
    row once completed.
    """
    check_rate_limit(user.id, "voice_start")
    _assert_elevenlabs_config()
    await _lock_user_voice_start(session, user.id)

    try:
        interview_uuid = uuid.UUID(req.interview_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid interview_id")

    stmt = select(Interview).where(
        Interview.id == interview_uuid,
        Interview.user_id == user.id,
    )
    result = await session.execute(stmt)
    interview = result.scalars().first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    if interview.status in ("COMPLETED", "FAILED"):
        raise HTTPException(status_code=400, detail="This interview is already closed")
    if interview.status == "INTERVIEWING":
        raise HTTPException(
            status_code=409,
            detail={
                "code": "voice_session_already_active",
                "message": "This interview is already marked as active.",
                "interview_id": str(interview.id),
                "retry_after_seconds": VOICE_START_COOLDOWN_SECONDS,
            },
            headers={"Retry-After": str(VOICE_START_COOLDOWN_SECONDS)},
        )

    await _assert_voice_start_allowed(session, user.id)

    outline = _safe_load_outline(interview.outline)
    research_context = outline.get("research_context") or {}
    prior_metadata = outline.get("dispatch_metadata") or {}

    # Profile reload — onboarding may have changed since the original call
    profile_stmt = select(UserProfile).where(UserProfile.user_id == user.id)
    profile_result = await session.execute(profile_stmt)
    profile = profile_result.scalars().first()

    topic_title = interview.topic or research_context.get("title") or "General Discussion"
    resolved_user_name = prior_metadata.get("user_name") or user.full_name or "Guest"

    try:
        memory_pack = await memory_pack_builder.build(
            session=session,
            user_id=str(user.id),
            topic=topic_title,
        )
    except Exception as exc:
        logger.warning("Memory pack build failed on resume: %s", exc)
        memory_pack = ""

    # Trim to the last ~8000 chars so the prompt stays bounded
    prior_transcript = (interview.raw_transcript or "").strip()
    if len(prior_transcript) > 8000:
        prior_transcript = "[...earlier portion truncated...]\n" + prior_transcript[-8000:]

    config = build_agent_config(
        topic_title=topic_title,
        global_context=research_context.get("deep_context") or "",
        why_this_matters=research_context.get("why_this_matters") or "",
        key_questions=research_context.get("key_questions") or research_context.get("discussion_points") or [],
        user_name=resolved_user_name,
        full_name=user.full_name,
        bio=profile.bio if profile else None,
        niche=profile.niche if profile else None,
        industry=profile.industry if profile else None,
        target_audience=profile.target_audience if profile else None,
        icp=profile.icp if profile else None,
        offer=profile.offer if profile else None,
        pain_solved=profile.pain_solved if profile else None,
        differentiator=profile.differentiator if profile else None,
        content_tone=profile.content_tone if profile else None,
        tone=profile.tone if profile else None,
        proof_points=profile.proof_points if profile else None,
        primary_goal=profile.primary_goal if profile else None,
        key_themes=profile.key_themes if profile else None,
        platforms=profile.platforms if profile else None,
        memory_pack=memory_pack,
        prior_conversation=prior_transcript or None,
    )

    outline["provider"] = "elevenlabs"
    outline["dispatch_sent_at"] = None
    outline["dispatch_metadata"] = {
        "system_prompt": config["systemPrompt"],
        "greeting": config["greeting"],
        "user_name": config["userName"],
        "topic_title": config["topicTitle"],
    }
    outline["resumed_at"] = datetime.now(timezone.utc).isoformat()
    interview.outline = json.dumps(outline)
    interview.status = "INTERVIEWING"
    await session.commit()
    await session.refresh(interview)

    signed_url = _get_elevenlabs_signed_url(settings.ELEVENLABS_AGENT_ID)
    overrides = {
        "agent": {
            "prompt": {"prompt": config["systemPrompt"]},
            "firstMessage": config["greeting"],
        }
    }

    return {
        "provider": "elevenlabs",
        "agentId": settings.ELEVENLABS_AGENT_ID,
        "signedUrl": signed_url,
        "overrides": overrides,
        "topicTitle": config["topicTitle"],
        "userName": config["userName"],
        "greeting": config["greeting"],
        "interviewId": str(interview.id),
        "resumed": True,
        "priorTranscript": interview.raw_transcript or "",
        "researchContext": {
            "title": topic_title,
            "deep_context": research_context.get("deep_context") or "",
            "key_insights": research_context.get("key_insights") or [],
            "discussion_points": research_context.get("discussion_points")
                or research_context.get("key_questions")
                or [],
            "contrarian_angles": research_context.get("contrarian_angles") or [],
            "sources": research_context.get("sources") or [],
        },
    }


@router.post("/extract")
async def extract(
    req: ExtractRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Fire background memory extraction for an already-saved interview.
    """
    try:
        interview_uuid = uuid.UUID(req.interview_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid interview_id")

    interview_id = str(interview_uuid)
    transcript = req.transcript
    topic = req.topic or "General Discussion"

    if not interview_id or not transcript:
        return {"status": "skipped", "reason": "missing interview_id or transcript"}

    stmt = select(Interview).where(Interview.id == interview_uuid, Interview.user_id == user.id)
    result = await session.execute(stmt)
    interview = result.scalars().first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    background_tasks.add_task(
        _run_extraction,
        interview_id=str(interview_id),
        user_id=str(user.id),
        transcript=transcript,
        topic=topic,
    )
    return {"status": "queued"}


async def _run_extraction(
    interview_id: str,
    user_id: str,
    transcript: str,
    topic: str,
):
    """Background task - creates its own DB session for extraction."""
    from app.db.database import async_session_maker

    async with async_session_maker() as session:
        await memory_extractor.extract_and_save(
            session=session,
            interview_id=interview_id,
            user_id=user_id,
            transcript=transcript,
            topic=topic,
        )

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Interview, UserProfile
from app.services.content_signals import extract_content_signals
from app.services.post_count_decision import allowed_max_counts, recommend_counts


def _has_reusable_analysis(summary: Any) -> bool:
    if not isinstance(summary, dict):
        return False
    if summary.get("state") not in {"analyzed", "generated", "insufficient_content"}:
        return False
    return isinstance(summary.get("signals"), list)


async def _load_owned_interview(
    session: AsyncSession,
    interview_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Interview:
    result = await session.execute(
        select(Interview).where(Interview.id == interview_id, Interview.user_id == user_id)
    )
    interview = result.scalars().first()
    if not interview:
        raise HTTPException(status_code=404, detail="interview_not_found")
    return interview


async def _load_profile(session: AsyncSession, user_id: uuid.UUID) -> UserProfile | None:
    result = await session.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    return result.scalars().first()


def _build_summary(
    analysis: dict[str, Any],
    profile: UserProfile | None,
) -> dict[str, Any]:
    posting_frequency = profile.posting_frequency if profile else None
    allowed = allowed_max_counts(analysis)
    recommended = recommend_counts(posting_frequency, analysis)

    state = "analyzed"
    if analysis["usable_signal_count"] == 0:
        state = "insufficient_content"

    warnings: list[str] = []
    if state == "insufficient_content":
        warnings.append(
            "This transcript does not contain enough usable content signals to generate a pack without becoming generic."
        )

    return {
        "state": state,
        "usable_signal_count": analysis["usable_signal_count"],
        "strong_signal_count": analysis["strong_signal_count"],
        "theme_cluster_count": len(analysis.get("theme_clusters") or []),
        "conversation_quality": analysis["conversation_quality"],
        "recommended_counts": recommended,
        "allowed_max_counts": allowed,
        "warnings": warnings,
        "signals": analysis["signals"],
        "theme_clusters": analysis.get("theme_clusters") or [],
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
    }


async def analyze_content_pack(
    session: AsyncSession,
    interview_id: uuid.UUID,
    user_id: uuid.UUID,
    force: bool = False,
) -> dict[str, Any]:
    interview = await _load_owned_interview(session, interview_id, user_id)

    if not force and _has_reusable_analysis(interview.content_pack_summary):
        summary = interview.content_pack_summary
        return {
            "interview_id": str(interview.id),
            "summary": {key: value for key, value in summary.items() if key not in {"signals", "theme_clusters"}},
            "signals": summary.get("signals") or [],
            "theme_clusters": summary.get("theme_clusters") or [],
        }

    transcript = (interview.raw_transcript or "").strip()
    if not transcript:
        raise HTTPException(status_code=400, detail="missing_transcript")

    profile = await _load_profile(session, user_id)
    analysis = await asyncio.to_thread(
        extract_content_signals,
        transcript,
        interview.topic or "General Discussion",
        profile,
    )
    summary = _build_summary(analysis, profile)

    interview.content_pack_summary = summary
    await session.commit()
    await session.refresh(interview)

    return {
        "interview_id": str(interview.id),
        "summary": {key: value for key, value in summary.items() if key not in {"signals", "theme_clusters"}},
        "signals": summary["signals"],
        "theme_clusters": summary["theme_clusters"],
    }

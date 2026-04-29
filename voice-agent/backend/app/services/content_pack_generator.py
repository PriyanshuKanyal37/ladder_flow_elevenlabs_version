import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ContentOutput, Interview, User, UserProfile
from app.services.content_pack_analyzer import analyze_content_pack
from app.services.post_count_decision import clamp_requested_counts
from app.services.weekly_content_writer import (
    generate_linkedin_outputs,
    generate_newsletter_outputs,
    generate_x_outputs,
)


def serialize_output(output: ContentOutput) -> dict[str, Any]:
    return {
        "id": str(output.id),
        "interview_id": str(output.interview_id),
        "platform": output.platform,
        "content_type": output.content_type,
        "title": output.title,
        "raw_content": output.raw_content,
        "edited_content": output.edited_content,
        "content": output.edited_content or output.raw_content,
        "status": output.status,
        "sort_order": output.sort_order,
        "signal_snapshot": output.signal_snapshot,
        "generation_metadata": output.generation_metadata,
        "created_at": output.created_at.isoformat() if output.created_at else None,
        "updated_at": output.updated_at.isoformat() if output.updated_at else None,
    }


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


async def _load_existing_outputs(
    session: AsyncSession,
    interview_id: uuid.UUID,
) -> list[ContentOutput]:
    result = await session.execute(
        select(ContentOutput)
        .where(
            ContentOutput.interview_id == interview_id,
            ContentOutput.status != "archived",
        )
        .order_by(ContentOutput.platform, ContentOutput.sort_order, ContentOutput.created_at)
    )
    return list(result.scalars().all())


async def _try_lock(session: AsyncSession, interview_id: uuid.UUID) -> bool:
    lock_key = f"content_pack:{interview_id}"
    return bool(
        await session.scalar(
            text("SELECT pg_try_advisory_lock(hashtext(:lock_key))"),
            {"lock_key": lock_key},
        )
    )


async def _unlock(session: AsyncSession, interview_id: uuid.UUID) -> None:
    lock_key = f"content_pack:{interview_id}"
    await session.execute(
        text("SELECT pg_advisory_unlock(hashtext(:lock_key))"),
        {"lock_key": lock_key},
    )


def _analysis_ready(summary: Any) -> bool:
    return isinstance(summary, dict) and isinstance(summary.get("signals"), list)


async def _ensure_analysis(
    session: AsyncSession,
    interview: Interview,
    user_id: uuid.UUID,
) -> dict[str, Any]:
    if not _analysis_ready(interview.content_pack_summary):
        await analyze_content_pack(
            session=session,
            interview_id=interview.id,
            user_id=user_id,
            force=False,
        )
        await session.refresh(interview)

    summary = interview.content_pack_summary
    if not _analysis_ready(summary):
        raise HTTPException(status_code=422, detail="insufficient_content")
    return summary


def _user_name(user: User) -> str:
    return user.full_name or "Creator"


def _generation_metadata(
    summary: dict[str, Any],
    requested_counts: dict[str, int],
    final_counts: dict[str, int],
    warnings: list[str],
) -> dict[str, Any]:
    return {
        "prompt_version": "weekly_pack_v1",
        "model": "gpt-4o",
        "requested_counts": requested_counts,
        "final_counts": final_counts,
        "usable_signal_count": summary.get("usable_signal_count", 0),
        "strong_signal_count": summary.get("strong_signal_count", 0),
        "warnings": warnings,
    }


def _fallback_signal_from_transcript(transcript: str, topic: str) -> dict[str, Any]:
    cleaned = " ".join((transcript or "").split())
    source_quote = cleaned[:500] if cleaned else "Transcript was captured, but no strong standalone quote was extracted."
    return {
        "type": "founder_insight",
        "title": f"Conversation notes on {topic}",
        "summary": (
            "Quality analysis did not find a strong standalone signal. "
            "This output was generated from the broader transcript and should be reviewed closely."
        ),
        "source_quote": source_quote,
        "strength": 0.75,
        "quality_override": True,
    }


def _signals_for_generation(
    summary: dict[str, Any],
    transcript: str,
    topic: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    signals = [
        signal
        for signal in (summary.get("signals") or [])
        if isinstance(signal, dict)
    ]
    theme_clusters = [
        cluster
        for cluster in (summary.get("theme_clusters") or [])
        if isinstance(cluster, dict)
    ]

    if signals:
        return signals, theme_clusters

    fallback_signal = _fallback_signal_from_transcript(transcript, topic)
    return [fallback_signal], [{
        "title": "Generated from broader transcript",
        "signal_titles": [fallback_signal["title"]],
    }]


def _make_output(
    interview: Interview,
    platform: str,
    content_type: str,
    item: dict[str, Any],
    metadata: dict[str, Any],
) -> ContentOutput:
    return ContentOutput(
        id=uuid.uuid4(),
        interview_id=interview.id,
        user_id=interview.user_id,
        platform=platform,
        content_type=content_type,
        title=item.get("title"),
        raw_content=item["content"],
        status="generated",
        sort_order=item["sort_order"],
        signal_snapshot=item.get("signal_snapshot"),
        generation_metadata=metadata,
    )


def _copy_legacy_columns(interview: Interview, outputs: list[ContentOutput]) -> None:
    first_linkedin = next((item for item in outputs if item.platform == "linkedin"), None)
    first_x = next((item for item in outputs if item.platform == "x"), None)
    first_newsletter = next((item for item in outputs if item.platform == "newsletter"), None)
    now = datetime.now(timezone.utc)

    if first_linkedin:
        interview.linkedin_post = first_linkedin.raw_content
        interview.linkedin_status = first_linkedin.status
        interview.linkedin_updated_at = now
    if first_x:
        interview.twitter_thread = first_x.raw_content
        interview.twitter_status = first_x.status
        interview.twitter_updated_at = now
    if first_newsletter:
        interview.newsletter_post = first_newsletter.raw_content
        interview.newsletter_status = first_newsletter.status
        interview.newsletter_updated_at = now


async def generate_content_pack(
    session: AsyncSession,
    interview_id: uuid.UUID,
    user: User,
    requested_counts: dict[str, Any] | None,
    force: bool = False,
) -> dict[str, Any]:
    locked = await _try_lock(session, interview_id)
    if not locked:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "already_running",
                "message": "Content pack generation is already running for this interview.",
            },
        )

    try:
        interview = await _load_owned_interview(session, interview_id, user.id)
        existing_outputs = await _load_existing_outputs(session, interview.id)
        if existing_outputs and not force:
            return {
                "interview_id": str(interview.id),
                "summary": interview.content_pack_summary or {},
                "outputs": [serialize_output(output) for output in existing_outputs],
            }

        if not (interview.raw_transcript or "").strip():
            raise HTTPException(status_code=400, detail="missing_transcript")

        if existing_outputs and force:
            for output in existing_outputs:
                output.status = "archived"

        profile = await _load_profile(session, user.id)
        summary = dict(await _ensure_analysis(session, interview, user.id))
        allowed_counts = summary.get("allowed_max_counts") or {}
        recommended_counts = summary.get("recommended_counts") or {}
        requested = requested_counts or recommended_counts
        final_counts, count_warnings = clamp_requested_counts(
            requested,
            allowed_counts,
            allow_quality_override=True,
        )

        if sum(final_counts.values()) == 0:
            summary["state"] = "insufficient_content"
            summary["final_counts"] = final_counts
            summary["warnings"] = list(dict.fromkeys((summary.get("warnings") or []) + count_warnings))
            interview.content_pack_summary = summary
            await session.commit()
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "insufficient_content",
                    "message": "This transcript does not contain enough usable content signals to generate a pack without becoming generic.",
                    "summary": summary,
                },
            )

        topic = interview.topic or "General Discussion"
        signals, theme_clusters = _signals_for_generation(
            summary,
            interview.raw_transcript or "",
            topic,
        )
        user_name = _user_name(user)
        metadata = _generation_metadata(summary, requested, final_counts, count_warnings)

        linkedin_items, x_items, newsletter_items = await asyncio.gather(
            asyncio.to_thread(
                generate_linkedin_outputs,
                topic,
                user_name,
                signals,
                final_counts["linkedin"],
                profile,
            ),
            asyncio.to_thread(
                generate_x_outputs,
                topic,
                user_name,
                signals,
                final_counts["x"],
                profile,
            ),
            asyncio.to_thread(
                generate_newsletter_outputs,
                topic,
                user_name,
                signals,
                theme_clusters,
                final_counts["newsletter"],
                profile,
            ),
        )

        new_outputs: list[ContentOutput] = []
        for item in linkedin_items:
            new_outputs.append(_make_output(interview, "linkedin", "linkedin_post", item, metadata))
        for item in x_items:
            new_outputs.append(_make_output(interview, "x", "x_thread", item, metadata))
        for item in newsletter_items:
            new_outputs.append(_make_output(interview, "newsletter", "newsletter_issue", item, metadata))

        if not new_outputs:
            raise HTTPException(status_code=500, detail="generation_failed")

        session.add_all(new_outputs)
        _copy_legacy_columns(interview, new_outputs)
        interview.status = "COMPLETED"
        summary["state"] = "generated"
        summary["requested_counts"] = requested
        summary["final_counts"] = {
            "linkedin": len(linkedin_items),
            "x": len(x_items),
            "newsletter": len(newsletter_items),
        }
        summary["warnings"] = list(dict.fromkeys((summary.get("warnings") or []) + count_warnings))
        summary["generated_at"] = datetime.now(timezone.utc).isoformat()
        interview.content_pack_summary = summary

        await session.commit()

        outputs = await _load_existing_outputs(session, interview.id)
        return {
            "interview_id": str(interview.id),
            "summary": interview.content_pack_summary or summary,
            "outputs": [serialize_output(output) for output in outputs],
        }
    except Exception:
        await session.rollback()
        raise
    finally:
        await _unlock(session, interview_id)

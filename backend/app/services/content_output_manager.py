import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ContentOutput, Interview, User, UserProfile
from app.services.content_pack_generator import serialize_output
from app.services.weekly_content_writer import (
    generate_linkedin_outputs,
    generate_newsletter_outputs,
    generate_x_outputs,
)


VALID_OUTPUT_STATUSES = {"generated", "draft", "published", "archived", "error"}
PLATFORM_ORDER = {"linkedin": 1, "x": 2, "newsletter": 3}


async def _load_owned_output(
    session: AsyncSession,
    output_id: uuid.UUID,
    user_id: uuid.UUID,
) -> ContentOutput:
    result = await session.execute(
        select(ContentOutput).where(
            ContentOutput.id == output_id,
            ContentOutput.user_id == user_id,
        )
    )
    output = result.scalars().first()
    if not output:
        raise HTTPException(status_code=404, detail="content_output_not_found")
    return output


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


async def _outputs_for_interview(
    session: AsyncSession,
    interview_id: uuid.UUID,
) -> list[ContentOutput]:
    result = await session.execute(
        select(ContentOutput).where(
            ContentOutput.interview_id == interview_id,
            ContentOutput.status != "archived",
        )
    )
    outputs = list(result.scalars().all())
    return sorted(
        outputs,
        key=lambda output: (
            PLATFORM_ORDER.get(output.platform, 99),
            output.sort_order,
            output.created_at,
        ),
    )


async def get_content_pack(
    session: AsyncSession,
    interview_id: uuid.UUID,
    user_id: uuid.UUID,
) -> dict[str, Any]:
    interview = await _load_owned_interview(session, interview_id, user_id)
    outputs = await _outputs_for_interview(session, interview.id)
    return {
        "interview_id": str(interview.id),
        "summary": interview.content_pack_summary or {},
        "outputs": [serialize_output(output) for output in outputs],
        "interview": {
            "id": str(interview.id),
            "topic": interview.topic,
            "status": interview.status,
            "duration_seconds": interview.duration_seconds,
            "raw_transcript": interview.raw_transcript,
            "created_at": interview.created_at.isoformat() if interview.created_at else None,
            "updated_at": interview.updated_at.isoformat() if interview.updated_at else None,
        },
    }


async def update_content_output(
    session: AsyncSession,
    output_id: uuid.UUID,
    user_id: uuid.UUID,
    edited_content: str | None = None,
    status: str | None = None,
) -> dict[str, Any]:
    if edited_content is None and status is None:
        raise HTTPException(status_code=400, detail="no_fields_to_update")
    if status is not None and status not in VALID_OUTPUT_STATUSES:
        raise HTTPException(status_code=400, detail="invalid_status")

    output = await _load_owned_output(session, output_id, user_id)
    if edited_content is not None:
        output.edited_content = edited_content
    if status is not None:
        output.status = status

    output.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(output)
    return serialize_output(output)


def _user_name(user: User) -> str:
    return user.full_name or "Creator"


def _newsletter_inputs(snapshot: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    signals = snapshot.get("signals")
    if not isinstance(signals, list):
        return [], []

    cleaned_signals = [
        signal
        for signal in signals
        if isinstance(signal, dict) and isinstance(signal.get("title"), str)
    ]
    if not cleaned_signals:
        return [], []

    theme = {
        "title": snapshot.get("title") or "Best ideas from the conversation",
        "signal_titles": [signal["title"] for signal in cleaned_signals],
    }
    return cleaned_signals, [theme]


async def regenerate_content_output(
    session: AsyncSession,
    output_id: uuid.UUID,
    user: User,
    instruction: str | None = None,
) -> dict[str, Any]:
    output = await _load_owned_output(session, output_id, user.id)
    if output.status == "archived":
        raise HTTPException(status_code=400, detail="cannot_regenerate_archived_output")

    interview = await _load_owned_interview(session, output.interview_id, user.id)
    profile = await _load_profile(session, user.id)
    topic = interview.topic or "General Discussion"
    user_name = _user_name(user)
    snapshot = output.signal_snapshot if isinstance(output.signal_snapshot, dict) else {}

    if output.platform == "linkedin":
        generated = await asyncio.to_thread(
            generate_linkedin_outputs,
            topic,
            user_name,
            [snapshot],
            1,
            profile,
            instruction,
        )
    elif output.platform == "x":
        generated = await asyncio.to_thread(
            generate_x_outputs,
            topic,
            user_name,
            [snapshot],
            1,
            profile,
            instruction,
        )
    elif output.platform == "newsletter":
        signals, themes = _newsletter_inputs(snapshot)
        generated = await asyncio.to_thread(
            generate_newsletter_outputs,
            topic,
            user_name,
            signals,
            themes,
            1,
            profile,
            instruction,
        )
    else:
        raise HTTPException(status_code=400, detail="unsupported_platform")

    if not generated:
        raise HTTPException(status_code=500, detail="regeneration_failed")

    generated_item = generated[0]
    previous_metadata = output.generation_metadata if isinstance(output.generation_metadata, dict) else {}
    output.title = generated_item.get("title") or output.title
    output.raw_content = generated_item["content"]
    output.edited_content = None
    output.status = "generated"
    output.signal_snapshot = generated_item.get("signal_snapshot") or output.signal_snapshot
    output.generation_metadata = {
        **previous_metadata,
        "regenerated_at": datetime.now(timezone.utc).isoformat(),
        "regeneration_instruction": instruction,
    }
    output.updated_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(output)
    return serialize_output(output)


async def archive_content_output(
    session: AsyncSession,
    output_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    output = await _load_owned_output(session, output_id, user_id)
    output.status = "archived"
    output.updated_at = datetime.now(timezone.utc)
    await session.commit()

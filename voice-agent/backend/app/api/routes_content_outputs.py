import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth_config import current_active_user
from app.db.database import get_async_session
from app.services.content_output_manager import (
    archive_content_output,
    regenerate_content_output,
    update_content_output,
)
from app.services.rate_limiter import check_rate_limit

router = APIRouter(prefix="/content-outputs", tags=["content-outputs"])


class ContentOutputUpdateRequest(BaseModel):
    edited_content: str | None = None
    status: Literal["generated", "draft", "published", "archived", "error"] | None = None


class ContentOutputRegenerateRequest(BaseModel):
    instruction: str | None = None


@router.patch("/{output_id}")
async def patch_output(
    output_id: uuid.UUID,
    data: ContentOutputUpdateRequest,
    user=Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await update_content_output(
            session=session,
            output_id=output_id,
            user_id=user.id,
            edited_content=data.edited_content,
            status=data.status,
        )
    except HTTPException:
        raise
    except Exception as exc:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"content_output_update_failed: {exc}")


@router.post("/{output_id}/regenerate")
async def regenerate_output(
    output_id: uuid.UUID,
    data: ContentOutputRegenerateRequest,
    user=Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    check_rate_limit(user.id, "content_output_regenerate")
    try:
        return await regenerate_content_output(
            session=session,
            output_id=output_id,
            user=user,
            instruction=data.instruction,
        )
    except HTTPException:
        raise
    except Exception as exc:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"content_output_regeneration_failed: {exc}")


@router.delete("/{output_id}", status_code=204)
async def delete_output(
    output_id: uuid.UUID,
    user=Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        await archive_content_output(
            session=session,
            output_id=output_id,
            user_id=user.id,
        )
        return None
    except HTTPException:
        raise
    except Exception as exc:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"content_output_archive_failed: {exc}")

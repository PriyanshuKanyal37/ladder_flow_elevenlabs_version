import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth_config import current_active_user
from app.db.database import get_async_session
from app.services.content_pack_analyzer import analyze_content_pack
from app.services.content_pack_generator import generate_content_pack
from app.services.content_output_manager import get_content_pack
from app.services.rate_limiter import check_rate_limit

router = APIRouter(prefix="/content-pack", tags=["content-pack"])


class ContentPackAnalyzeRequest(BaseModel):
    interview_id: uuid.UUID
    force: bool = False


class ContentPackCounts(BaseModel):
    linkedin: int = 0
    x: int = 0
    newsletter: int = 0


class ContentPackGenerateRequest(BaseModel):
    interview_id: uuid.UUID
    force: bool = False
    requested_counts: ContentPackCounts | None = None


@router.post("/analyze")
async def analyze_pack(
    data: ContentPackAnalyzeRequest,
    user=Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await analyze_content_pack(
            session=session,
            interview_id=data.interview_id,
            user_id=user.id,
            force=data.force,
        )
    except HTTPException:
        raise
    except Exception as exc:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"content_pack_analysis_failed: {exc}")


@router.post("/generate")
async def generate_pack(
    data: ContentPackGenerateRequest,
    user=Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    check_rate_limit(user.id, "content_pack_generate")
    try:
        requested_counts = (
            data.requested_counts.model_dump()
            if data.requested_counts is not None
            else None
        )
        return await generate_content_pack(
            session=session,
            interview_id=data.interview_id,
            user=user,
            requested_counts=requested_counts,
            force=data.force,
        )
    except HTTPException:
        raise
    except Exception as exc:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"content_pack_generation_failed: {exc}")


@router.get("/{interview_id}")
async def get_pack(
    interview_id: uuid.UUID,
    user=Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await get_content_pack(
            session=session,
            interview_id=interview_id,
            user_id=user.id,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"content_pack_fetch_failed: {exc}")

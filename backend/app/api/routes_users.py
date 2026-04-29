import uuid
import logging
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth_config import current_active_user
from app.db.database import get_async_session
from app.db.models import User, UserProfile
from app.services.neo4j_service import sync_onboarding_to_neo4j

router = APIRouter(prefix="/api/users", tags=["user_profiles"])
logger = logging.getLogger(__name__)


class ProofPoint(BaseModel):
    text: str = ""
    visibility: Literal["private", "publishable"] = "private"


class OnboardingData(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    niche: Optional[str] = None
    industry: Optional[str] = None
    target_audience: Optional[str] = None
    content_tone: Optional[str] = None
    linkedin_url: Optional[str] = None
    twitter_url: Optional[str] = None
    website_url: Optional[str] = None
    icp: Optional[str] = None
    offer: Optional[str] = None
    pain_solved: Optional[str] = None
    differentiator: Optional[str] = None
    proof_points: list[ProofPoint] = Field(default_factory=list)
    tone: list[str] = Field(default_factory=list)
    taboo_words: list[str] = Field(default_factory=list)
    cta_preferences: list[str] = Field(default_factory=list)
    content_examples: list[str] = Field(default_factory=list)
    primary_goal: Optional[str] = None
    key_themes: list[str] = Field(default_factory=list)
    posting_frequency: Optional[str] = None
    platforms: list[str] = Field(default_factory=list)
    default_visibility: Optional[str] = None
    share_analytics: Optional[bool] = None
    onboarding_completed: Optional[bool] = None


class UserProfileResponse(BaseModel):
    onboarding_completed: bool
    full_name: Optional[str] = None
    bio: Optional[str] = None
    niche: Optional[str] = None
    industry: Optional[str] = None
    target_audience: Optional[str] = None
    content_tone: Optional[str] = None
    linkedin_url: Optional[str] = None
    twitter_url: Optional[str] = None
    website_url: Optional[str] = None
    icp: Optional[str] = None
    offer: Optional[str] = None
    pain_solved: Optional[str] = None
    differentiator: Optional[str] = None
    proof_points: list[ProofPoint] = Field(default_factory=list)
    tone: list[str] = Field(default_factory=list)
    taboo_words: list[str] = Field(default_factory=list)
    cta_preferences: list[str] = Field(default_factory=list)
    content_examples: list[str] = Field(default_factory=list)
    primary_goal: Optional[str] = None
    key_themes: list[str] = Field(default_factory=list)
    posting_frequency: Optional[str] = None
    platforms: list[str] = Field(default_factory=list)
    default_visibility: str = "private"
    share_analytics: bool = False


def _clean_list(values: Optional[list[str]]) -> list[str]:
    if not values:
        return []
    return [value.strip() for value in values if isinstance(value, str) and value.strip()]


def _normalize_content_tone(data: OnboardingData) -> Optional[str]:
    if data.content_tone and data.content_tone.strip():
        return data.content_tone.strip()
    tones = _clean_list(data.tone)
    return ", ".join(tones) if tones else None


def _normalize_target_audience(data: OnboardingData) -> Optional[str]:
    if data.target_audience and data.target_audience.strip():
        return data.target_audience.strip()
    if data.icp and data.icp.strip():
        return data.icp.strip()
    return None


def _profile_to_response(user: User, profile: UserProfile | None) -> UserProfileResponse:
    if not profile:
        return UserProfileResponse(
            onboarding_completed=False,
            full_name=user.full_name,
        )

    tone = _clean_list(profile.tone)
    if not tone and profile.content_tone:
        tone = [profile.content_tone]

    return UserProfileResponse(
        onboarding_completed=bool(profile.onboarding_completed),
        full_name=user.full_name,
        bio=profile.bio,
        niche=profile.niche,
        industry=profile.industry,
        target_audience=profile.target_audience,
        content_tone=profile.content_tone,
        linkedin_url=profile.linkedin_url,
        twitter_url=profile.twitter_url,
        website_url=profile.website_url,
        icp=profile.icp,
        offer=profile.offer,
        pain_solved=profile.pain_solved,
        differentiator=profile.differentiator,
        proof_points=profile.proof_points or [],
        tone=tone,
        taboo_words=_clean_list(profile.taboo_words),
        cta_preferences=_clean_list(profile.cta_preferences),
        content_examples=_clean_list(profile.content_examples),
        primary_goal=profile.primary_goal,
        key_themes=_clean_list(profile.key_themes),
        posting_frequency=profile.posting_frequency,
        platforms=_clean_list(profile.platforms),
        default_visibility=profile.default_visibility or "private",
        share_analytics=bool(profile.share_analytics),
    )


@router.post("/onboarding")
async def save_onboarding_data(
    data: OnboardingData,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Persist the frontend onboarding/settings payload onto the user profile."""
    try:
        stmt = select(UserProfile).where(UserProfile.user_id == user.id)
        result = await session.execute(stmt)
        profile = result.scalars().first()

        normalized_tone = _clean_list(data.tone)
        normalized_taboo_words = _clean_list(data.taboo_words)
        normalized_cta_preferences = _clean_list(data.cta_preferences)
        normalized_examples = _clean_list(data.content_examples)
        normalized_themes = _clean_list(data.key_themes)
        normalized_platforms = _clean_list(data.platforms)
        normalized_content_tone = _normalize_content_tone(data)
        normalized_target_audience = _normalize_target_audience(data)
        normalized_proof_points = [point.model_dump() for point in data.proof_points]

        if data.full_name is not None:
            user.full_name = data.full_name.strip() or None

        profile_values = {
            "bio": data.bio,
            "niche": data.niche,
            "industry": data.industry,
            "target_audience": normalized_target_audience,
            "content_tone": normalized_content_tone,
            "linkedin_url": data.linkedin_url,
            "twitter_url": data.twitter_url,
            "website_url": data.website_url,
            "icp": data.icp,
            "offer": data.offer,
            "pain_solved": data.pain_solved,
            "differentiator": data.differentiator,
            "proof_points": normalized_proof_points,
            "tone": normalized_tone,
            "taboo_words": normalized_taboo_words,
            "cta_preferences": normalized_cta_preferences,
            "content_examples": normalized_examples,
            "primary_goal": data.primary_goal,
            "key_themes": normalized_themes,
            "posting_frequency": data.posting_frequency,
            "platforms": normalized_platforms,
            "default_visibility": data.default_visibility or "private",
            "share_analytics": bool(data.share_analytics) if data.share_analytics is not None else False,
        }

        if profile:
            for field, value in profile_values.items():
                setattr(profile, field, value)
            profile.onboarding_completed = True
        else:
            profile = UserProfile(
                id=uuid.uuid4(),
                user_id=user.id,
                onboarding_completed=True,
                **profile_values,
            )
            session.add(profile)

        await session.commit()
        await session.refresh(user)
        await session.refresh(profile)

        neo4j_synced = False
        try:
            sync_onboarding_to_neo4j(
                user_id=str(user.id),
                niche=profile.niche,
                industry=profile.industry,
                content_tone=profile.content_tone,
                target_audience=profile.target_audience,
                display_name=user.full_name,
                bio=profile.bio,
                icp=profile.icp,
                offer=profile.offer,
                pain_solved=profile.pain_solved,
                differentiator=profile.differentiator,
                primary_goal=profile.primary_goal,
                key_themes=profile.key_themes,
                platforms=profile.platforms,
            )
            neo4j_synced = True
        except Exception as sync_error:
            logger.warning(
                "Neo4j onboarding sync failed for user %s: %s",
                user.id,
                sync_error,
            )

        return {
            "status": "success",
            "message": "Onboarding completed successfully.",
            "neo4j_synced": neo4j_synced,
            "profile": _profile_to_response(user, profile).model_dump(),
        }
    except Exception as exc:
        await session.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/profile", response_model=UserProfileResponse)
async def get_user_profile(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Fetch the current user's full persisted profile in frontend shape."""
    stmt = select(UserProfile).where(UserProfile.user_id == user.id)
    result = await session.execute(stmt)
    profile = result.scalars().first()
    return _profile_to_response(user, profile)

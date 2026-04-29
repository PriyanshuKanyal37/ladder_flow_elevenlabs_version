import uuid
from datetime import datetime
from typing import Optional

from fastapi_users.db import SQLAlchemyBaseUserTableUUID
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, Integer, Float, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.db.database import Base


# ==============================================================================
# TABLE 1: users
# Managed by FastAPI-Users. Columns auto-added:
#   id, email, hashed_password, is_active, is_superuser, is_verified
# We add: full_name, created_at
# ==============================================================================
class User(SQLAlchemyBaseUserTableUUID, Base):
    __tablename__ = "users"

    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    profile: Mapped[Optional["UserProfile"]] = relationship(
        "UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    interviews: Mapped[list["Interview"]] = relationship(
        "Interview", back_populates="user", cascade="all, delete-orphan"
    )
    memory_items: Mapped[list["MemoryItem"]] = relationship(
        "MemoryItem", back_populates="user", cascade="all, delete-orphan",
        foreign_keys="MemoryItem.user_id"
    )
    content_outputs: Mapped[list["ContentOutput"]] = relationship(
        "ContentOutput", back_populates="user", cascade="all, delete-orphan"
    )


# ==============================================================================
# TABLE 2: user_profiles
# Created when user completes the onboarding form
# ==============================================================================
class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, unique=True
    )

    niche: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    industry: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    target_audience: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    content_tone: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    linkedin_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    twitter_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    website_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icp: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    offer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pain_solved: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    differentiator: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    primary_goal: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    posting_frequency: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    default_visibility: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    share_analytics: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    proof_points: Mapped[Optional[list[dict]]] = mapped_column(JSONB, nullable=True)
    tone: Mapped[Optional[list[str]]] = mapped_column(JSONB, nullable=True)
    taboo_words: Mapped[Optional[list[str]]] = mapped_column(JSONB, nullable=True)
    cta_preferences: Mapped[Optional[list[str]]] = mapped_column(JSONB, nullable=True)
    content_examples: Mapped[Optional[list[str]]] = mapped_column(JSONB, nullable=True)
    key_themes: Mapped[Optional[list[str]]] = mapped_column(JSONB, nullable=True)
    platforms: Mapped[Optional[list[str]]] = mapped_column(JSONB, nullable=True)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="profile")


# ==============================================================================
# TABLE 3: interviews
# One row = one full session (research + voice interview + all generated content)
# ==============================================================================
class Interview(Base):
    __tablename__ = "interviews"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Session data
    topic: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    outline: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    raw_transcript: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), default="STARTED", nullable=False
        # Values: STARTED → RESEARCHING → INTERVIEWING → DRAFT → COMPLETED → FAILED
        # DRAFT = interview interrupted; resumable via /agent-config/resume
    )
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Generated content (all 3 outputs stored in this same row)
    linkedin_post: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    twitter_thread: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    newsletter_post: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Per-platform state (draft|generated|published|archived); NULL = no post
    linkedin_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    twitter_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    newsletter_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    linkedin_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    twitter_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    newsletter_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Autosave heartbeat + resume bookkeeping for draft sessions
    last_saved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resume_state: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    content_pack_summary: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User", back_populates="interviews")
    memory_items: Mapped[list["MemoryItem"]] = relationship(
        "MemoryItem", back_populates="interview", cascade="all, delete-orphan"
    )
    content_outputs: Mapped[list["ContentOutput"]] = relationship(
        "ContentOutput", back_populates="interview", cascade="all, delete-orphan"
    )


# ==============================================================================
# TABLE 4: content_outputs
# One row = one generated, editable content asset from an interview
# ==============================================================================
class ContentOutput(Base):
    __tablename__ = "content_outputs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    platform: Mapped[str] = mapped_column(String(30), nullable=False)
    content_type: Mapped[str] = mapped_column(String(50), nullable=False)

    title: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    raw_content: Mapped[str] = mapped_column(Text, nullable=False)
    edited_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(String(20), default="generated", nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    signal_snapshot: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    generation_metadata: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    interview: Mapped["Interview"] = relationship("Interview", back_populates="content_outputs")
    user: Mapped["User"] = relationship("User", back_populates="content_outputs")


# ==============================================================================
# TABLE 5: memory_items
# One row = one extracted insight from a transcript (the Digital Brain)
# ==============================================================================
class MemoryItem(Base):
    __tablename__ = "memory_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    source_interview_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="SET NULL"), nullable=True)

    type: Mapped[str] = mapped_column(String(50), nullable=False)         # opinion|framework|story|proof|belief|style
    content_text: Mapped[str] = mapped_column(Text, nullable=False)
    trust_tier: Mapped[str] = mapped_column(String(1), default="B", nullable=False)  # A|B|C
    privacy_mode: Mapped[str] = mapped_column(String(20), default="private", nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_superseded: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    superseded_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)

    use_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reuse_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # embedding column exists in DB as pgvector — not mapped in SQLAlchemy (queried raw)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="memory_items", foreign_keys=[user_id])
    interview: Mapped[Optional["Interview"]] = relationship("Interview", back_populates="memory_items")
    versions: Mapped[list["MemoryVersion"]] = relationship("MemoryVersion", back_populates="memory_item", cascade="all, delete-orphan")


# ==============================================================================
# TABLE 6: memory_versions
# Archives old memory content when a memory is updated/contradicted
# ==============================================================================
class MemoryVersion(Base):
    __tablename__ = "memory_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    memory_item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("memory_items.id", ondelete="CASCADE"), nullable=False)

    content_text: Mapped[str] = mapped_column(Text, nullable=False)
    trust_tier: Mapped[str] = mapped_column(String(1), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    change_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    memory_item: Mapped["MemoryItem"] = relationship("MemoryItem", back_populates="versions")


# ==============================================================================
# TABLE 7: topic_registry
# Every topic a user has discussed — how deep, how often
# ==============================================================================
class TopicRegistry(Base):
    __tablename__ = "topic_registry"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    topic_name: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False)          # Technology|Marketing|Leadership|Business
    times_discussed: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    depth: Mapped[str] = mapped_column(String(20), default="surface", nullable=False)  # surface|moderate|deep

    # embedding column exists in DB as pgvector — not mapped in SQLAlchemy (queried raw)
    first_discussed: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_discussed: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

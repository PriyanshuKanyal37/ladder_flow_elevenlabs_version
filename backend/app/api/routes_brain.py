import logging
import uuid as _uuid

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAI
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.auth_config import current_active_user
from app.core.config import settings
from app.db.database import get_async_session
from app.db.models import UserProfile, MemoryItem, MemoryVersion
from app.services import neo4j_service
from app.services.rate_limiter import check_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/brain", tags=["brain"])

TRUST_MAP = {"A": "high", "B": "medium", "C": "low"}
TYPE_MAP = {"proof": "proof_point"}

VALID_TRUST_TIERS = {"A", "B", "C"}
VALID_PRIVACY_MODES = {"private", "publishable"}


class BrainChatRequest(BaseModel):
    query: str


async def _require_onboarded_user(
    user=Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    profile_result = await session.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    profile = profile_result.scalars().first()
    if not profile or not profile.onboarding_completed:
        raise HTTPException(
            status_code=403,
            detail="Complete onboarding before accessing Digital Brain.",
        )
    return user


async def _active_memory_ids(session: AsyncSession, user_id) -> set[str]:
    result = await session.execute(
        select(MemoryItem.id).where(
            MemoryItem.user_id == user_id,
            MemoryItem.is_active == True,
        )
    )
    return {str(memory_id) for memory_id in result.scalars().all()}


def _filter_graph_to_active_memories(data: dict, active_memory_ids: set[str]) -> dict:
    nodes = data.get("nodes") or []
    links = data.get("links") or []
    kept_nodes = []
    kept_node_ids = set()

    for node in nodes:
        node_id = node.get("id")
        is_memory = node.get("type") == "memory" or node.get("node_kind") == "memory"
        if is_memory and node_id not in active_memory_ids:
            continue
        kept_nodes.append(node)
        kept_node_ids.add(node_id)

    kept_links = [
        link for link in links
        if link.get("source") in kept_node_ids and link.get("target") in kept_node_ids
    ]
    return {"nodes": kept_nodes, "links": kept_links}


@router.get("/graph")
async def get_brain_graph(
    user=Depends(_require_onboarded_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Return the user's Neo4j knowledge graph for visualization."""
    try:
        user_id = str(user.id)
        data = neo4j_service.get_user_graph(user_id)

        # Read-repair for older users whose onboarding data exists in Neon but
        # was never synced to Neo4j (e.g. historical silent failures).
        if not data["nodes"]:
            profile_result = await session.execute(
                select(UserProfile).where(UserProfile.user_id == user.id)
            )
            profile = profile_result.scalars().first()
            if profile and profile.onboarding_completed:
                try:
                    neo4j_service.sync_onboarding_to_neo4j(
                        user_id=user_id,
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
                    data = neo4j_service.get_user_graph(user_id)
                except Exception as sync_error:
                    logger.warning(
                        "Neo4j read-repair sync failed for user %s: %s",
                        user_id,
                        sync_error,
                    )
        active_memory_ids = await _active_memory_ids(session, user.id)
        return _filter_graph_to_active_memories(data, active_memory_ids)
    except Exception as e:
        logger.warning(f"Neo4j graph fetch failed for user {user.id}: {e}")
        return {"nodes": [], "links": []}


@router.get("/memories")
async def list_brain_memories(
    user=Depends(_require_onboarded_user),
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(
        text("""
            SELECT mi.id AS memory_id, mi.type, mi.content_text, mi.trust_tier, mi.privacy_mode,
                   mi.created_at, COALESCE(i.topic, '') AS topic
            FROM memory_items mi
            LEFT JOIN interviews i ON mi.source_interview_id = i.id
            WHERE mi.user_id = :user_id AND mi.is_active = true
            ORDER BY mi.created_at DESC
        """),
        {"user_id": str(user.id)},
    )
    rows = result.fetchall()
    return [
        {
            "id": str(r.memory_id),
            "type": TYPE_MAP.get(r.type, r.type),
            "content": r.content_text,
            "topic": r.topic,
            "trust_tier": TRUST_MAP.get(r.trust_tier, "medium"),
            "visibility": r.privacy_mode,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.post("/chat")
async def brain_chat(
    req: BrainChatRequest,
    user=Depends(_require_onboarded_user),
    session: AsyncSession = Depends(get_async_session),
):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    check_rate_limit(user.id, "brain_chat")

    count_result = await session.execute(
        text(
            "SELECT COUNT(*) FROM memory_items "
            "WHERE user_id = :uid AND is_active = true AND embedding IS NOT NULL"
        ),
        {"uid": str(user.id)},
    )
    if not count_result.scalar():
        return {
            "answer": "You don't have any stored memories yet. Complete some interviews first to build your Digital Brain.",
            "citations": [],
        }

    openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
    emb = openai_client.embeddings.create(
        input=req.query,
        model="text-embedding-3-small",
    ).data[0].embedding
    emb_str = "[" + ",".join(str(x) for x in emb) + "]"

    result = await session.execute(
        text(f"""
            SELECT mi.content_text, mi.type, COALESCE(i.topic, '') AS topic
            FROM memory_items mi
            LEFT JOIN interviews i ON mi.source_interview_id = i.id
            WHERE mi.user_id = :user_id
              AND mi.is_active = true
              AND mi.embedding IS NOT NULL
            ORDER BY mi.embedding <=> '{emb_str}'::vector
            LIMIT 5
        """),
        {"user_id": str(user.id)},
    )
    memories = result.fetchall()

    context = "\n".join(f"- [{m.type}] {m.content_text}" for m in memories)
    citations = list({m.topic for m in memories if m.topic})

    claude_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    answer = claude_client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[{
            "role": "user",
            "content": (
                "You are a Digital Brain assistant. Answer the user's question using ONLY the memories below. "
                "Be concise (2-4 sentences). If the memories don't directly answer the question, say so honestly.\n\n"
                f"Memories:\n{context}\n\n"
                f"Question: {req.query}\n\nAnswer:"
            ),
        }],
    ).content[0].text

    return {"answer": answer, "citations": citations}


# ==============================================================================
# PATCH /brain/memories/{memory_id}
# Edits content_text, trust_tier, or privacy_mode.
# Content changes: archives old version + re-embeds.
# ==============================================================================
class MemoryPatchRequest(BaseModel):
    content_text: str | None = None
    trust_tier: str | None = None   # A | B | C
    privacy_mode: str | None = None  # private | publishable


@router.patch("/memories/{memory_id}")
async def patch_brain_memory(
    memory_id: str,
    body: MemoryPatchRequest,
    user=Depends(_require_onboarded_user),
    session: AsyncSession = Depends(get_async_session),
):
    # Validate inputs
    if body.trust_tier and body.trust_tier not in VALID_TRUST_TIERS:
        raise HTTPException(status_code=422, detail=f"trust_tier must be one of {VALID_TRUST_TIERS}")
    if body.privacy_mode and body.privacy_mode not in VALID_PRIVACY_MODES:
        raise HTTPException(status_code=422, detail=f"privacy_mode must be one of {VALID_PRIVACY_MODES}")
    if not any([body.content_text, body.trust_tier, body.privacy_mode]):
        raise HTTPException(status_code=422, detail="At least one field required")

    # Fetch memory and verify ownership
    try:
        mem_uuid = _uuid.UUID(memory_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Memory not found")

    result = await session.execute(
        select(MemoryItem).where(
            MemoryItem.id == mem_uuid,
            MemoryItem.user_id == user.id,
            MemoryItem.is_active == True,
        )
    )
    memory = result.scalars().first()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    neo4j_content: str | None = None
    neo4j_trust: str | None = None

    # — Content update: archive old, re-embed
    if body.content_text and body.content_text.strip() != memory.content_text:
        new_text = body.content_text.strip()

        # Archive old version
        version = MemoryVersion(
            memory_item_id=memory.id,
            content_text=memory.content_text,
            trust_tier=memory.trust_tier,
            change_reason="user_edit",
        )
        session.add(version)

        # Update Neon content
        memory.content_text = new_text
        neo4j_content = new_text

        # Re-embed (sync — user is waiting for save confirmation)
        try:
            openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
            emb = openai_client.embeddings.create(
                input=new_text,
                model="text-embedding-3-small",
            ).data[0].embedding
            emb_str = "[" + ",".join(str(x) for x in emb) + "]"
            await session.execute(
                text("UPDATE memory_items SET embedding = :emb::vector WHERE id = :id"),
                {"emb": emb_str, "id": str(memory.id)},
            )
        except Exception as e:
            logger.warning("Re-embedding failed for memory %s: %s", memory_id, e)

    # — Trust tier update
    if body.trust_tier and body.trust_tier != memory.trust_tier:
        memory.trust_tier = body.trust_tier
        neo4j_trust = body.trust_tier

    # — Privacy mode update
    if body.privacy_mode and body.privacy_mode != memory.privacy_mode:
        memory.privacy_mode = body.privacy_mode

    await session.commit()

    # Sync to Neo4j (best-effort, non-blocking failure)
    if neo4j_content or neo4j_trust:
        try:
            neo4j_service.update_memory_node(
                neon_id=str(memory.id),
                content=neo4j_content,
                trust_tier=neo4j_trust,
            )
        except Exception as e:
            logger.warning("Neo4j memory update failed for %s: %s", memory_id, e)

    return {
        "id": str(memory.id),
        "content": memory.content_text,
        "trust_tier": TRUST_MAP.get(memory.trust_tier, "medium"),
        "visibility": memory.privacy_mode,
    }


# ==============================================================================
# DELETE /brain/memories/{memory_id}
# Soft-deletes in Neon (is_active=False) + removes HAS_MEMORY edge in Neo4j.
# ==============================================================================
@router.delete("/memories/{memory_id}", status_code=204)
async def delete_brain_memory(
    memory_id: str,
    user=Depends(_require_onboarded_user),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        mem_uuid = _uuid.UUID(memory_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Memory not found")

    result = await session.execute(
        select(MemoryItem).where(
            MemoryItem.id == mem_uuid,
            MemoryItem.user_id == user.id,
            MemoryItem.is_active == True,
        )
    )
    memory = result.scalars().first()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    memory.is_active = False
    await session.commit()

    try:
        neo4j_service.remove_has_memory_edge(neon_id=str(memory.id))
    except Exception as e:
        logger.warning("Neo4j HAS_MEMORY removal failed for %s: %s", memory_id, e)

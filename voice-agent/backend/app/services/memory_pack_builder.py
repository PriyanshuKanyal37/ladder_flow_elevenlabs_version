"""
Memory Pack Builder — assembles a 2500-char context string from a user's
top memories, injected into the agent system prompt before each interview.

Priority order:
  1. Memories about the current topic (via Neo4j graph query)
  2. High reuse_score memories (most valuable across all topics)
  3. Most recent memories (recency bias)

Trust filter: only tier A and B memories are included.
"""

import logging
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from openai import OpenAI

from app.db.models import MemoryItem
from app.services import neo4j_service
from app.core.config import settings

logger = logging.getLogger(__name__)

openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)

MAX_PACK_CHARS = 5000
MAX_TOPIC_MEMORIES = 15
MAX_BACKGROUND_MEMORIES = 10

TYPE_LABELS = {
    "opinion":   "OPINION",
    "framework": "FRAMEWORK",
    "story":     "STORY",
    "proof":     "PROOF",
    "belief":    "BELIEF",
    "style":     "STYLE",
}


def _get_topic_embedding(topic: str) -> list[float]:
    response = openai_client.embeddings.create(
        input=topic,
        model="text-embedding-3-small",
    )
    return response.data[0].embedding


async def build(
    session: AsyncSession,
    user_id: str,
    topic: str,
) -> str:
    """
    Returns a formatted memory pack string ready for injection into the system prompt.
    Returns empty string if user has no memories yet.
    """
    import uuid as _uuid

    # Step 1 — get topic-relevant memory IDs from Neo4j (ordered: topic-direct first)
    neo4j_ids: list[str] = []
    try:
        neo4j_ids = neo4j_service.get_memory_ids_for_topic(
            user_id=user_id,
            topic_name=topic,
            limit=MAX_TOPIC_MEMORIES,
        )
    except Exception as e:
        logger.warning(f"Neo4j topic query failed, falling back to Neon only: {e}")

    topic_memories: list[MemoryItem] = []

    # Step 2 — fetch Neo4j-suggested topic memories preserving Neo4j rank order
    if neo4j_ids:
        valid_uuids = [_uuid.UUID(i) for i in neo4j_ids if i]
        result = await session.execute(
            select(MemoryItem).where(
                MemoryItem.user_id == _uuid.UUID(user_id),
                MemoryItem.id.in_(valid_uuids),
                MemoryItem.trust_tier.in_(["A", "B"]),
                MemoryItem.is_active == True,
            )
        )
        fetched = {m.id: m for m in result.scalars().all()}
        # Preserve Neo4j topic-rank order
        topic_memories = [fetched[uid] for uid in valid_uuids if uid in fetched]

    # Step 3 — fill remaining topic slots via embedding similarity
    if len(topic_memories) < MAX_TOPIC_MEMORIES:
        needed = MAX_TOPIC_MEMORIES - len(topic_memories)
        existing_ids = {m.id for m in topic_memories}
        try:
            topic_emb = _get_topic_embedding(topic)
            emb_str = "[" + ",".join(str(x) for x in topic_emb) + "]"
            result = await session.execute(
                text(f"""
                    SELECT id FROM memory_items
                    WHERE user_id = :user_id
                      AND trust_tier IN ('A', 'B')
                      AND is_active = true
                      AND embedding IS NOT NULL
                    ORDER BY
                        (reuse_score * 0.4) +
                        (1 - (embedding <=> '{emb_str}'::vector)) * 0.6 DESC
                    LIMIT :limit
                """),
                {"user_id": str(user_id), "limit": needed + len(existing_ids)},
            )
            fallback_ids = [
                _uuid.UUID(str(row[0])) for row in result.fetchall()
                if _uuid.UUID(str(row[0])) not in existing_ids
            ][:needed]
            if fallback_ids:
                fb_result = await session.execute(
                    select(MemoryItem).where(MemoryItem.id.in_(fallback_ids))
                )
                topic_memories.extend(fb_result.scalars().all())
        except Exception as e:
            logger.warning(f"Embedding-based topic fill failed: {e}")
            result = await session.execute(
                select(MemoryItem).where(
                    MemoryItem.user_id == _uuid.UUID(user_id),
                    MemoryItem.trust_tier.in_(["A", "B"]),
                    MemoryItem.is_active == True,
                ).order_by(MemoryItem.reuse_score.desc()).limit(needed)
            )
            topic_memories.extend(m for m in result.scalars().all() if m.id not in existing_ids)

    # Step 4 — fetch background memories (all other A/B memories not already in topic set)
    topic_ids = {m.id for m in topic_memories}
    background_memories: list[MemoryItem] = []
    try:
        bg_result = await session.execute(
            select(MemoryItem).where(
                MemoryItem.user_id == _uuid.UUID(user_id),
                MemoryItem.trust_tier.in_(["A", "B"]),
                MemoryItem.is_active == True,
                MemoryItem.id.not_in(topic_ids) if topic_ids else True,
            ).order_by(MemoryItem.reuse_score.desc()).limit(MAX_BACKGROUND_MEMORIES)
        )
        background_memories = list(bg_result.scalars().all())
    except Exception as e:
        logger.warning(f"Background memory fetch failed: {e}")

    if not topic_memories and not background_memories:
        return ""

    # Step 5 — assemble two-section pack
    type_order = ["belief", "opinion", "framework", "story", "proof", "style"]

    def _sort_key(m: MemoryItem):
        return (type_order.index(m.type) if m.type in type_order else 99, -m.reuse_score)

    def _format_section(mems: list[MemoryItem], budget: int) -> tuple[list[str], int]:
        lines, used = [], 0
        for mem in sorted(mems, key=_sort_key):
            label = TYPE_LABELS.get(mem.type, mem.type.upper())
            line = f"[{label}] {mem.content_text}"
            if used + len(line) + 1 > budget:
                break
            lines.append(line)
            used += len(line) + 1
        return lines, used

    # Give topic section 65% of budget, background gets the rest
    topic_budget = int(MAX_PACK_CHARS * 0.65)
    bg_budget = MAX_PACK_CHARS - topic_budget

    topic_lines, topic_used = _format_section(topic_memories, topic_budget)
    bg_lines, _ = _format_section(background_memories, bg_budget)

    sections = []
    if topic_lines:
        sections.append(
            "[TOPIC-RELEVANT MEMORIES]\n"
            "These memories are directly related to today's topic. "
            "Use them to go deeper, skip ground already covered, and connect the guest's past thinking to current discussion.\n"
            + "\n".join(topic_lines)
        )
    if bg_lines:
        sections.append(
            "[BACKGROUND MEMORIES]\n"
            "General context about this guest. Use as silent background — bring up only when the conversation flows naturally toward them.\n"
            + "\n".join(bg_lines)
        )

    if not sections:
        return ""

    return "USER CONTEXT FOR THIS SESSION:\n\n" + "\n\n".join(sections)

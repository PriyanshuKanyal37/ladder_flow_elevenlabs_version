"""
Memory Extractor — runs as a background job after every interview.

Flow:
  1. Claude reads the transcript via tool_use (guaranteed valid schema)
  2. Tool input = structured memories + relationships + topics
  3. Each memory saved to Neon (memory_items)
  4. Embedding generated + stored
  5. Topics upserted in topic_registry
  6. Nodes + edges written to Neo4j
"""

import uuid
import logging
from datetime import datetime, timezone

import anthropic
from openai import OpenAI
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import MemoryItem, MemoryVersion, TopicRegistry
from app.services import neo4j_service
from app.core.config import settings

logger = logging.getLogger(__name__)

claude = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)

# ==============================================================================
# Tool definition — Claude MUST call this tool, guaranteeing valid structure
# ==============================================================================
SAVE_MEMORIES_TOOL = {
    "name": "save_memories",
    "description": "Save extracted memories, relationships, and topics from the interview transcript.",
    "input_schema": {
        "type": "object",
        "properties": {
            "memories": {
                "type": "array",
                "description": "Key insights extracted from the GUEST's speech only.",
                "items": {
                    "type": "object",
                    "properties": {
                        "type": {
                            "type": "string",
                            "enum": ["opinion", "framework", "story", "proof", "belief", "style"],
                            "description": "opinion=strong stance, framework=mental model/process, story=personal anecdote, proof=stat or result, belief=core value, style=signature phrase"
                        },
                        "content": {
                            "type": "string",
                            "description": "Clear standalone sentence capturing the insight. 10-80 words. Self-contained without needing context."
                        },
                        "topic": {
                            "type": "string",
                            "description": "Short topic label (2-4 words)"
                        },
                        "category": {
                            "type": "string",
                            "enum": ["Technology", "Marketing", "Leadership", "Business", "Other"]
                        },
                        "trust_tier": {
                            "type": "string",
                            "enum": ["A", "B", "C"],
                            "description": "A=high conviction/repeated, B=clear single statement, C=hedged/passing mention"
                        }
                    },
                    "required": ["type", "content", "topic", "category", "trust_tier"]
                }
            },
            "relationships": {
                "type": "array",
                "description": "Connections between memories by their index in the memories array.",
                "items": {
                    "type": "object",
                    "properties": {
                        "from_index": {"type": "integer", "description": "Index of the source memory"},
                        "to_index": {"type": "integer", "description": "Index of the target memory"},
                        "type": {
                            "type": "string",
                            "enum": ["SUPPORTS", "CONTRADICTS", "ILLUSTRATES"],
                            "description": "SUPPORTS=one strengthens another, CONTRADICTS=they conflict, ILLUSTRATES=one is an example of another"
                        }
                    },
                    "required": ["from_index", "to_index", "type"]
                }
            },
            "topics_discussed": {
                "type": "array",
                "description": "All topics covered in the interview.",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "category": {
                            "type": "string",
                            "enum": ["Technology", "Marketing", "Leadership", "Business", "Other"]
                        }
                    },
                    "required": ["name", "category"]
                }
            }
        },
        "required": ["memories", "relationships", "topics_discussed"]
    }
}

EXTRACTION_PROMPT = """You are a Digital Brain extraction engine. Your job is to analyze a voice interview transcript and extract the guest's sharpest thinking into structured, reusable memory items.

<source_rules>
- Extract ONLY from the GUEST's speech. The guest may be labeled "You:", "Guest:", "Speaker:", or similar — extract from whichever speaker is NOT the AI Host.
- Ignore everything the AI Host says — it is not source material.
- Skip all filler: "I agree", "That's interesting", "Yeah", "You know", "Um" — only extract real substance.
- If the guest said very little or nothing substantive, return empty arrays. Do not fabricate.
</source_rules>

<quality_rules>
- Each memory must be SELF-CONTAINED — readable and meaningful without any conversation context.
- Minimum 10 words, maximum 80 words per memory.
- Write in the guest's voice and perspective (first person "I/we" when appropriate).
- Be specific: include names, numbers, timeframes, tools, or outcomes mentioned by the guest.
- Extract 3-12 memories depending on transcript substance. Quality over quantity.
- NEVER extract the same insight twice in different words. If two statements express the same core idea, keep only the stronger, more specific version.
</quality_rules>

<memory_types>
Choose the MOST specific type that fits. Use this decision guide:

- opinion: A strong STANCE on a debatable topic. The guest is taking a side. Test: would someone reasonable disagree?
  Examples: "Cold outreach is dead for B2B SaaS", "AI won't replace salespeople, it'll replace sales managers"

- framework: A REPEATABLE mental model, process, or system. Has structure (steps, categories, rules). Test: could someone else follow this?
  Examples: "My 3-step approach to pricing: anchor high, show the math, never discount", "The way I evaluate hires is culture-add, not culture-fit"

- story: A SPECIFIC personal anecdote with a clear situation, action, and outcome. Has characters, timeline, or named events.
  Examples: "When we lost our biggest client in Q3, I called every team lead personally and we recovered 80% within a month"

- proof: A CONCRETE stat, metric, data point, or measurable result. Has numbers.
  Examples: "We went from 2M to 8M ARR in 14 months", "Our conversion rate doubled after removing the pricing page"

- belief: A CORE VALUE or worldview that shapes how they operate. Deeper than opinion — it's a life principle.
  Examples: "I believe people over process — you can fix a broken system, but you can't fix a toxic culture"

- style: A SIGNATURE phrase, communication pattern, or distinctive way of expressing ideas that recurs.
  Examples: "They always say 'build the plane while flying it' when describing their startup approach"
</memory_types>

<trust_tier_assignment>
Assign a trust tier to each memory based on how it was expressed:
- "A": Repeated across multiple topics OR stated with very high conviction and specificity. The guest clearly believes this deeply.
- "B": A clear, specific single statement. The guest said it with confidence but didn't reinforce it further.
- "C": Mentioned in passing, hedged ("I think maybe..."), or expressed with uncertainty.
</trust_tier_assignment>

<relationship_guide>
When identifying relationships between memories:
- SUPPORTS: One memory strengthens or provides evidence for another (e.g., a proof memory backing an opinion)
- CONTRADICTS: Two memories express conflicting ideas (rare but valuable — shows nuanced thinking)
- ILLUSTRATES: One memory is a concrete example of another (e.g., a story that demonstrates a framework)
</relationship_guide>

Interview topic: {topic}

Transcript:
{transcript}

Call the save_memories tool with everything you extracted."""


# ==============================================================================
# Helpers
# ==============================================================================
def _generate_embedding(content: str) -> list[float]:
    response = openai_client.embeddings.create(
        input=content,
        model="text-embedding-3-small",
    )
    return response.data[0].embedding


async def _get_or_create_topic(
    session: AsyncSession,
    user_id: str,
    topic_name: str,
    category: str,
) -> TopicRegistry:
    result = await session.execute(
        select(TopicRegistry).where(
            TopicRegistry.user_id == uuid.UUID(user_id),
            TopicRegistry.topic_name == topic_name,
        )
    )
    topic = result.scalars().first()

    if topic:
        topic.times_discussed += 1
        topic.last_discussed = datetime.now(timezone.utc)
        if topic.times_discussed >= 4:
            topic.depth = "deep"
        elif topic.times_discussed >= 2:
            topic.depth = "moderate"
    else:
        embedding = _generate_embedding(topic_name)
        topic = TopicRegistry(
            user_id=uuid.UUID(user_id),
            topic_name=topic_name,
            category=category,
            times_discussed=1,
            depth="surface",
        )
        session.add(topic)
        await session.flush()
        emb_str = "[" + ",".join(str(x) for x in embedding) + "]"
        await session.execute(
            text(f"UPDATE topic_registry SET embedding = '{emb_str}'::vector WHERE id = :id"),
            {"id": str(topic.id)},
        )

    return topic


async def _check_similar_memory(
    session: AsyncSession,
    user_id: str,
    content: str,
    embedding: list[float],
    threshold: float = 0.85,
) -> MemoryItem | None:
    """Find an existing memory with high similarity (potential evolution)."""
    emb_str = "[" + ",".join(str(x) for x in embedding) + "]"
    result = await session.execute(
        text(f"""
            SELECT id
            FROM memory_items
            WHERE user_id = :user_id
              AND is_active = true
              AND embedding IS NOT NULL
              AND 1 - (embedding <=> '{emb_str}'::vector) > :threshold
            ORDER BY 1 - (embedding <=> '{emb_str}'::vector) DESC
            LIMIT 1
        """),
        {"user_id": user_id, "threshold": threshold},
    )
    row = result.fetchone()
    if row:
        mem_result = await session.execute(
            select(MemoryItem).where(MemoryItem.id == row[0])
        )
        return mem_result.scalars().first()
    return None


# ==============================================================================
# Main entry point
# ==============================================================================
async def extract_and_save(
    session: AsyncSession,
    interview_id: str,
    user_id: str,
    transcript: str,
    topic: str,
):
    """
    Main entry point — called as a background task after interview ends.
    Uses Claude tool_use to guarantee valid structured output.
    """
    logger.info(f"Starting memory extraction for interview {interview_id}")

    if not transcript or len(transcript.strip()) < 100:
        logger.warning(f"Transcript too short for interview {interview_id}, skipping")
        return

    # Step 1 — Claude extracts via tool use (no JSON parsing needed)
    try:
        response = claude.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            tools=[SAVE_MEMORIES_TOOL],
            tool_choice={"type": "any"},  # force Claude to call the tool
            messages=[{
                "role": "user",
                "content": EXTRACTION_PROMPT.format(
                    transcript=transcript,
                    topic=topic,
                ),
            }],
        )

        # Find the tool_use block in the response
        tool_block = next(
            (b for b in response.content if b.type == "tool_use"),
            None,
        )
        if not tool_block:
            logger.warning(f"Claude did not call save_memories tool for interview {interview_id}")
            return

        extracted = tool_block.input  # already a dict — no json.loads needed

    except Exception as e:
        logger.error(f"Claude extraction failed for interview {interview_id}: {e}")
        return

    memories_data = extracted.get("memories", [])
    relationships_data = extracted.get("relationships", [])
    topics_data = extracted.get("topics_discussed", [])

    if not memories_data:
        logger.info(f"No memories extracted for interview {interview_id}")
        return

    logger.info(f"Extracted {len(memories_data)} memories, {len(topics_data)} topics for interview {interview_id}")

    # Step 2 — Ensure user + interview nodes in Neo4j
    neo4j_service.ensure_user_node(user_id)
    neo4j_service.create_interview_node(interview_id, user_id, topic)

    # Step 3 — Upsert topics in Neon + update expertise edges in Neo4j
    for t in topics_data:
        topic_obj = await _get_or_create_topic(
            session, user_id, t["name"], t.get("category", "Other")
        )
        neo4j_service.update_user_topic_expertise(
            user_id, t["name"], topic_obj.times_discussed
        )

    await session.commit()

    # Step 4 — Save each memory to Neon + Neo4j
    saved_memory_ids: list[str | None] = []

    for mem_data in memories_data:
        content = mem_data.get("content", "").strip()
        if not content:
            saved_memory_ids.append(None)
            continue

        # Generate embedding once — reuse for similarity check + storage
        embedding = _generate_embedding(content)

        # Check for similar existing memory (evolution detection)
        existing = await _check_similar_memory(session, user_id, content, embedding)

        if existing:
            # Archive old version
            version = MemoryVersion(
                memory_item_id=existing.id,
                content_text=existing.content_text,
                trust_tier=existing.trust_tier,
                change_reason=f"Updated from interview {interview_id}",
            )
            session.add(version)

            # Update memory with new content + embedding
            existing.content_text = content
            existing.source_interview_id = uuid.UUID(interview_id)
            existing.last_used_at = datetime.now(timezone.utc)

            emb_str = "[" + ",".join(str(x) for x in embedding) + "]"
            await session.execute(
                text(f"UPDATE memory_items SET embedding = '{emb_str}'::vector WHERE id = :id"),
                {"id": str(existing.id)},
            )

            saved_memory_ids.append(str(existing.id))

            # Neo4j: update node + EVOLVED_FROM edge
            neo4j_service.create_memory_node(
                neon_id=str(existing.id),
                user_id=user_id,
                memory_type=mem_data.get("type", "opinion"),
                content=content,
                trust_tier=mem_data.get("trust_tier", "B"),
                interview_id=interview_id,
            )

        else:
            # Brand new memory
            memory = MemoryItem(
                user_id=uuid.UUID(user_id),
                source_interview_id=uuid.UUID(interview_id),
                type=mem_data.get("type", "opinion"),
                content_text=content,
                trust_tier=mem_data.get("trust_tier", "B"),
                privacy_mode="private",
            )
            session.add(memory)
            await session.flush()

            emb_str = "[" + ",".join(str(x) for x in embedding) + "]"
            await session.execute(
                text(f"UPDATE memory_items SET embedding = '{emb_str}'::vector WHERE id = :id"),
                {"id": str(memory.id)},
            )

            saved_memory_ids.append(str(memory.id))

            # Neo4j: Memory node + ABOUT_TOPIC edge
            neo4j_service.create_memory_node(
                neon_id=str(memory.id),
                user_id=user_id,
                memory_type=memory.type,
                content=content,
                trust_tier=mem_data.get("trust_tier", "B"),
                interview_id=interview_id,
            )
            neo4j_service.link_memory_to_topic(
                neon_id=str(memory.id),
                user_id=user_id,
                topic_name=mem_data.get("topic", topic),
                category=mem_data.get("category", "Other"),
            )

    await session.commit()

    # Step 5 — Memory-to-memory relationships in Neo4j
    for rel in relationships_data:
        from_idx = rel.get("from_index")
        to_idx = rel.get("to_index")
        rel_type = rel.get("type", "SUPPORTS")

        if (
            from_idx is not None
            and to_idx is not None
            and from_idx < len(saved_memory_ids)
            and to_idx < len(saved_memory_ids)
            and saved_memory_ids[from_idx]
            and saved_memory_ids[to_idx]
        ):
            try:
                neo4j_service.link_memories(
                    from_neon_id=saved_memory_ids[from_idx],
                    to_neon_id=saved_memory_ids[to_idx],
                    rel_type=rel_type,
                )
            except Exception as e:
                logger.warning(f"Failed to create relationship {rel_type}: {e}")

    logger.info(
        f"Extraction complete for interview {interview_id}: "
        f"{len([x for x in saved_memory_ids if x])} memories saved"
    )

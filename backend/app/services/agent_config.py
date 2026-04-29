from typing import TypedDict, Optional
from langgraph.graph import StateGraph, END
from app.core.config import settings
import json
from datetime import datetime
from zoneinfo import ZoneInfo

from app.prompts.agent_prompt import SYSTEM_PROMPT

class AgentState(TypedDict):
    topic_title: str
    global_context: str
    why_this_matters: str
    key_questions: list[str]
    user_name: str
    full_name: Optional[str]
    bio: Optional[str]
    niche: Optional[str]
    industry: Optional[str]
    target_audience: Optional[str]
    icp: Optional[str]
    offer: Optional[str]
    pain_solved: Optional[str]
    differentiator: Optional[str]
    content_tone: Optional[str]
    tone: list[str]
    proof_points: list[dict]
    primary_goal: Optional[str]
    key_themes: list[str]
    platforms: list[str]
    memory_pack: Optional[str]
    prior_conversation: Optional[str]
    current_date_context: str
    # These blocks are being replaced by the structured outline,
    # but we'll keep the keys in state to avoid breaking other potential consumers if any
    context_block: str
    why_block: str
    questions_block: str
    system_prompt: str
    runtime_config: dict


def _clean_list(values: Optional[list[str]]) -> list[str]:
    if not values:
        return []
    return [value.strip() for value in values if isinstance(value, str) and value.strip()]


def _proof_hooks(proof_points: list[dict]) -> list[str]:
    hooks: list[str] = []
    for point in proof_points:
        if not isinstance(point, dict):
            continue
        text = str(point.get("text") or "").strip()
        if text:
            hooks.append(text[:180])
        if len(hooks) >= 3:
            break
    return hooks


def _current_session_context() -> dict[str, str]:
    now = datetime.now(ZoneInfo("Asia/Kolkata"))
    return {
        "current_date": f"{now.strftime('%B')} {now.day}, {now.year}",
        "current_day": now.strftime("%A"),
        "current_time": now.strftime("%I:%M %p %Z"),
        "timezone": "Asia/Kolkata",
        "iso_datetime": now.isoformat(),
    }


def _format_session_context(context: dict[str, str]) -> str:
    return (
        f"Current date: {context['current_date']}\n"
        f"Current day: {context['current_day']}\n"
        f"Current time: {context['current_time']}\n"
        f"Timezone: {context['timezone']}\n"
        "If the guest asks about today's date, day, or current session time, "
        "answer from this block. Do not say you lack real-time access for these values."
    )


def construct_research_outline(state: AgentState) -> str:
    """
    Construct the RESEARCH_OUTLINE JSON using the existing state inputs.
    Adapts the simple input list into the rich schema required by the new prompt.
    """
    
    # 1. Guest Profile (uses real user profile data when available)
    niche = state["niche"]
    industry = state["industry"]
    target_audience = state["target_audience"] or state["icp"]
    content_tone = state["content_tone"] or ", ".join(_clean_list(state["tone"]))
    known_for = [value for value in [niche, industry, *state["key_themes"]] if value][:4]

    bio_parts = []
    if state["bio"]:
        bio_parts.append(state["bio"])
    if niche:
        bio_parts.append(f"Works in the {niche} space.")
    if state["offer"]:
        bio_parts.append(f"Core offer: {state['offer']}.")
    if state["pain_solved"]:
        bio_parts.append(f"Solves: {state['pain_solved']}.")
    if state["differentiator"]:
        bio_parts.append(f"Differentiator: {state['differentiator']}.")
    bio_summary = " ".join(bio_parts) if bio_parts else "A guest expert on the topic."

    guest_profile = {
        "name": state["full_name"] or state["user_name"],
        "title": industry or "Content Creator",
        "company": "",
        "bio_summary": bio_summary,
        "known_for": known_for,
        "recent_activity": [
            value for value in [
                state["primary_goal"],
                f"Publishes on {', '.join(state['platforms'])}" if state["platforms"] else None,
                f"Focus themes: {', '.join(state['key_themes'][:3])}" if state["key_themes"] else None,
            ] if value
        ],
        "personal_hooks": _proof_hooks(state["proof_points"]),
    }

    # 2. Episode Config (uses real tone and audience when available)
    episode_config = {
        "target_length": "medium",
        "tone": content_tone or "warm",
        "target_audience": target_audience or "general audience",
    }

    # 3. Segments (Mapped from key_questions & global_context)
    segments = []
    
    # Create a primary segment from the main global context if it exists
    user_context_bits = [
        state["global_context"],
        f"Offer: {state['offer']}" if state["offer"] else "",
        f"Pain solved: {state['pain_solved']}" if state["pain_solved"] else "",
        f"Differentiator: {state['differentiator']}" if state["differentiator"] else "",
    ]
    guest_angle = " ".join(bit for bit in user_context_bits if bit).strip()

    if state["global_context"] or guest_angle:
        segments.append({
            "id": 1,
            "topic": state["topic_title"],
            "priority": "must_cover",
            "trending_context": state["why_this_matters"], # specific urgency map
            "suggested_questions": [],
            "guest_angle": guest_angle[:240],
            "depth_target": "deep"
        })

    # Create segments for each key question provided
    # Start ID from 2 since 1 is the main topic
    start_id = 2
    for i, question in enumerate(state["key_questions"]):
        segments.append({
            "id": start_id + i,
            "topic": f"Key Insight {i+1}",
            "priority": "must_cover" if i < 2 else "if_time", # Prioritize first 2
            "trending_context": "",
            "suggested_questions": [question],
            "guest_angle": "Expert opinion",
            "depth_target": "moderate"
        })

    for i, theme in enumerate(state["key_themes"][:3]):
        segments.append({
            "id": start_id + len(state["key_questions"]) + i,
            "topic": theme,
            "priority": "if_time",
            "trending_context": "",
            "suggested_questions": [],
            "guest_angle": state["differentiator"] or "Subject-matter expertise",
            "depth_target": "moderate",
        })

    # 4. Closing (Defaults)
    closing = {
        "signature_question": "What is the one thing everyone gets wrong about this topic?",
        "plug_prompt": "Tell us where people can find more about your work."
    }

    # Assemble full object
    outline = {
        "guest_profile": guest_profile,
        "episode_config": episode_config,
        "segments": segments,
        "closing": closing
    }

    return json.dumps(outline, indent=2)


def build_context(state: AgentState) -> AgentState:
    """
    Pass-through for now, or use to prep data. 
    The new prompt relies on the JSON injection in `build_prompt`.
    We keep this to satisfy the graph structure.
    """
    return state


def build_prompt(state: AgentState) -> AgentState:
    """Assemble the full dynamic system prompt with the injected RESEARCH_OUTLINE."""
    
    # Construct the strict JSON outline from our state
    research_outline_json = construct_research_outline(state)

    # Inject memory pack if available
    memory_section = ""
    if state.get("memory_pack"):
        memory_section = f"\n\n[MEMORY_PACK]\n{state['memory_pack']}\n[/MEMORY_PACK]"

    profile_context_lines = []
    if state.get("offer"):
        profile_context_lines.append(f"Offer: {state['offer']}")
    if state.get("pain_solved"):
        profile_context_lines.append(f"Pain solved: {state['pain_solved']}")
    if state.get("differentiator"):
        profile_context_lines.append(f"Differentiator: {state['differentiator']}")
    if state.get("primary_goal"):
        profile_context_lines.append(f"Primary goal: {state['primary_goal']}")
    if state.get("platforms"):
        profile_context_lines.append(f"Platforms: {', '.join(state['platforms'])}")
    if state.get("key_themes"):
        profile_context_lines.append(f"Key themes: {', '.join(state['key_themes'])}")
    if state.get("proof_points"):
        excerpts = _proof_hooks(state["proof_points"])
        if excerpts:
            profile_context_lines.append("Proof points: " + " | ".join(excerpts))
    profile_context = ""
    if profile_context_lines:
        profile_context = "\n\n[PROFILE_CONTEXT]\n" + "\n".join(profile_context_lines) + "\n[/PROFILE_CONTEXT]"

    # Inject prior conversation if this is a resume session
    prior_section = ""
    if state.get("prior_conversation"):
        prior_section = (
            "\n\n[PRIOR_CONVERSATION]\n"
            "The user left this session earlier and has just returned to continue it. "
            "Below is the transcript of what you already discussed. Briefly acknowledge the "
            "return (one short sentence), then pick up naturally from the last unresolved thread. "
            "Do NOT re-ask questions that were already answered. Do NOT recap the whole conversation.\n\n"
            f"{state['prior_conversation']}\n"
            "[/PRIOR_CONVERSATION]"
        )

    # Combine strict system prompt with the injected outline + memory
    full_prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"[SESSION_CONTEXT]\n"
        f"{state['current_date_context']}\n"
        f"[/SESSION_CONTEXT]\n\n"
        f"[RESEARCH_OUTLINE]\n"
        f"{research_outline_json}\n"
        f"[/RESEARCH_OUTLINE]"
        f"{profile_context}"
        f"{memory_section}"
        f"{prior_section}"
    )

    return {**state, "system_prompt": full_prompt}


def assemble_livekit_metadata(state: AgentState) -> AgentState:
    """
    Prepare the LiveKit session metadata.
    Instead of a legacy provider config blob, we just finalize the system_prompt
    and a natural greeting. The actual audio pipeline lives in agent_worker.py.
    """
    t = state["topic_title"]
    u = state["user_name"]

    if state.get("prior_conversation"):
        greeting = (
            f"Hey {u}, welcome back. "
            f"Let's pick up where we left off on {t}."
        )
    else:
        # Warm, casual greeting injected as the agent's opening line
        greeting = (
            f"Hey {u}! Really glad you're here. "
            f"We're talking about {t} today. "
            f"Before we get into it — how are you doing?"
        )

    return {
        **state,
        "runtime_config": {
            "greeting": greeting,
            # New runtime policy used by the voice worker.
            "stt_model": "flux-general-en",
            "llm_model": "gpt-4.1",
            "llm_max_completion_tokens": 450,
            "tts_model": "eleven_multilingual_v2",
            "min_endpointing_delay": 0.45,
            "thinking_hold_seconds": 2.2,
            "long_pause_seconds": 6.0,
        },
    }


def _build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("build_context", build_context)
    graph.add_node("build_prompt", build_prompt)
    graph.add_node("assemble_config", assemble_livekit_metadata)

    graph.set_entry_point("build_context")
    graph.add_edge("build_context", "build_prompt")
    graph.add_edge("build_prompt", "assemble_config")
    graph.add_edge("assemble_config", END)

    return graph.compile()


_graph = _build_graph()


def build_agent_config(
    topic_title: str,
    global_context: str,
    why_this_matters: str,
    key_questions: list[str],
    user_name: str,
    full_name: Optional[str] = None,
    bio: Optional[str] = None,
    niche: Optional[str] = None,
    industry: Optional[str] = None,
    target_audience: Optional[str] = None,
    icp: Optional[str] = None,
    offer: Optional[str] = None,
    pain_solved: Optional[str] = None,
    differentiator: Optional[str] = None,
    content_tone: Optional[str] = None,
    tone: Optional[list[str]] = None,
    proof_points: Optional[list[dict]] = None,
    primary_goal: Optional[str] = None,
    key_themes: Optional[list[str]] = None,
    platforms: Optional[list[str]] = None,
    memory_pack: Optional[str] = None,
    prior_conversation: Optional[str] = None,
) -> dict:
    """
    Run the LangGraph pipeline and return LiveKit session config.

    Returns:
        systemPrompt  – full dynamic prompt for the agent worker
        topicTitle    – resolved topic string
        userName      – resolved user name
        greeting      – warm opening line the agent speaks first
        runtimeConfig – runtime turn/model settings for the worker

    When `prior_conversation` is provided, the pipeline treats this as a resume
    session and injects the existing transcript so the agent continues
    contextually instead of starting over.
    """
    session_context = _current_session_context()
    initial_state: AgentState = {
        "current_date_context": _format_session_context(session_context),
        "topic_title": topic_title,
        "global_context": global_context,
        "why_this_matters": why_this_matters,
        "key_questions": key_questions,
        "user_name": user_name,
        "full_name": full_name,
        "bio": bio,
        "niche": niche,
        "industry": industry,
        "target_audience": target_audience,
        "icp": icp,
        "offer": offer,
        "pain_solved": pain_solved,
        "differentiator": differentiator,
        "content_tone": content_tone,
        "tone": _clean_list(tone),
        "proof_points": proof_points or [],
        "primary_goal": primary_goal,
        "key_themes": _clean_list(key_themes),
        "platforms": _clean_list(platforms),
        "memory_pack": memory_pack,
        "prior_conversation": prior_conversation,
        "context_block": "",
        "why_block": "",
        "questions_block": "",
        "system_prompt": "",
        "runtime_config": {},
    }

    result = _graph.invoke(initial_state)

    default_greeting = (
        f"Hey {user_name}, welcome back! Let's pick up where we left off."
        if prior_conversation
        else f"Hey {user_name}! Ready to jump in?"
    )
    return {
        "systemPrompt": result["system_prompt"],
        "topicTitle": result["topic_title"],
        "userName": result["user_name"],
        "greeting": result["runtime_config"].get("greeting", default_greeting),
        "runtimeConfig": result.get("runtime_config", {}),
        "dynamicVariables": session_context,
    }

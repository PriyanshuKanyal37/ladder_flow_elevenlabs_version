import json
import re
from typing import Any

from openai import OpenAI

from app.core.config import settings
from app.prompts.weekly_pack_prompts import (
    LINKEDIN_PACK_PROMPT,
    NEWSLETTER_PACK_PROMPT,
    X_PACK_PROMPT,
)


def _profile_context(user_profile: Any) -> str:
    if not user_profile:
        return "No saved profile."

    fields = {
        "target_audience": getattr(user_profile, "target_audience", None),
        "content_tone": getattr(user_profile, "content_tone", None),
        "primary_goal": getattr(user_profile, "primary_goal", None),
        "key_themes": getattr(user_profile, "key_themes", None),
        "cta_preferences": getattr(user_profile, "cta_preferences", None),
        "taboo_words": getattr(user_profile, "taboo_words", None),
    }
    return json.dumps(fields, ensure_ascii=False, default=str)


def _load_json_object(raw: str) -> dict[str, Any]:
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            return {}
        parsed = json.loads(match.group(0))
        return parsed if isinstance(parsed, dict) else {}


def _chat_json(prompt: str, max_tokens: int) -> dict[str, Any]:
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    completion = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": "Return only valid JSON. Write publishable content grounded only in provided transcript signals.",
            },
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.65,
        max_tokens=max_tokens,
    )
    return _load_json_object(completion.choices[0].message.content or "{}")


def _clean_text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _instruction_block(instruction: str | None) -> str:
    instruction = _clean_text(instruction)
    if not instruction:
        return ""
    return (
        "<regeneration_instruction>\n"
        f"Apply this user instruction while still following all source-grounding rules: {instruction}\n"
        "</regeneration_instruction>"
    )


def _signal_map(signals: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {
        signal["title"]: signal
        for signal in signals
        if isinstance(signal, dict) and isinstance(signal.get("title"), str)
    }


def _coerce_signal_outputs(
    raw_items: Any,
    item_key: str,
    signals: list[dict[str, Any]],
    count: int,
) -> list[dict[str, Any]]:
    if not isinstance(raw_items, list):
        return []

    by_title = _signal_map(signals)
    outputs: list[dict[str, Any]] = []

    for index, raw_item in enumerate(raw_items[:count]):
        if not isinstance(raw_item, dict):
            continue

        content = _clean_text(raw_item.get("content"))
        if not content:
            continue

        signal_title = _clean_text(raw_item.get("signal_title"))
        signal = by_title.get(signal_title) or (signals[index] if index < len(signals) else None)
        if not signal:
            continue

        outputs.append({
            "title": _clean_text(raw_item.get("title")) or signal["title"],
            "content": content,
            "signal_snapshot": signal,
            "sort_order": len(outputs) + 1,
        })

    return outputs


def generate_linkedin_outputs(
    topic: str,
    user_name: str,
    signals: list[dict[str, Any]],
    count: int,
    user_profile: Any = None,
    instruction: str | None = None,
) -> list[dict[str, Any]]:
    selected = signals[:count]
    if not selected:
        return []

    prompt = LINKEDIN_PACK_PROMPT.format(
        count=len(selected),
        topic=topic,
        user_name=user_name,
        profile_context=_profile_context(user_profile),
        instruction_block=_instruction_block(instruction),
        signals_json=json.dumps(selected, ensure_ascii=False),
    )
    parsed = _chat_json(prompt, max_tokens=1200 * len(selected))
    return _coerce_signal_outputs(parsed.get("posts"), "posts", selected, len(selected))


def generate_x_outputs(
    topic: str,
    user_name: str,
    signals: list[dict[str, Any]],
    count: int,
    user_profile: Any = None,
    instruction: str | None = None,
) -> list[dict[str, Any]]:
    strong_signals = [signal for signal in signals if float(signal.get("strength") or 0) >= 0.75]
    selected = strong_signals[:count]
    if len(selected) < count:
        selected_titles = {signal.get("title") for signal in selected}
        selected.extend(
            signal
            for signal in signals
            if signal.get("title") not in selected_titles
        )
        selected = selected[:count]
    if not selected:
        return []

    prompt = X_PACK_PROMPT.format(
        count=len(selected),
        topic=topic,
        user_name=user_name,
        profile_context=_profile_context(user_profile),
        instruction_block=_instruction_block(instruction),
        signals_json=json.dumps(selected, ensure_ascii=False),
    )
    parsed = _chat_json(prompt, max_tokens=1500 * len(selected))
    return _coerce_signal_outputs(parsed.get("posts"), "posts", selected, len(selected))


def generate_newsletter_outputs(
    topic: str,
    user_name: str,
    signals: list[dict[str, Any]],
    theme_clusters: list[dict[str, Any]],
    count: int,
    user_profile: Any = None,
    instruction: str | None = None,
) -> list[dict[str, Any]]:
    if count <= 0:
        return []

    signals_by_title = _signal_map(signals)
    selected_themes = theme_clusters[:count]
    if not selected_themes and signals:
        selected_themes = [{
            "title": "Best ideas from the conversation",
            "signal_titles": [signal["title"] for signal in signals[:5]],
        }]

    selected_themes = selected_themes[:count]
    if not selected_themes:
        return []

    themes_with_signals = []
    for theme in selected_themes:
        signal_titles = theme.get("signal_titles") or []
        theme_signals = [
            signals_by_title[title]
            for title in signal_titles
            if isinstance(title, str) and title in signals_by_title
        ]
        if theme_signals:
            themes_with_signals.append({
                "title": theme.get("title"),
                "signals": theme_signals[:5],
            })

    if not themes_with_signals:
        return []

    prompt = NEWSLETTER_PACK_PROMPT.format(
        count=len(themes_with_signals),
        topic=topic,
        user_name=user_name,
        profile_context=_profile_context(user_profile),
        instruction_block=_instruction_block(instruction),
        themes_json=json.dumps(themes_with_signals, ensure_ascii=False),
    )
    parsed = _chat_json(prompt, max_tokens=2400 * len(themes_with_signals))

    raw_items = parsed.get("newsletters")
    if not isinstance(raw_items, list):
        return []

    outputs: list[dict[str, Any]] = []
    for index, raw_item in enumerate(raw_items[:len(themes_with_signals)]):
        if not isinstance(raw_item, dict):
            continue

        content = _clean_text(raw_item.get("content"))
        if not content:
            continue

        theme = themes_with_signals[index]
        outputs.append({
            "title": _clean_text(raw_item.get("title")) or str(theme["title"]),
            "content": content,
            "signal_snapshot": {
                "type": "theme_cluster",
                "title": theme["title"],
                "signals": theme["signals"],
            },
            "sort_order": len(outputs) + 1,
        })

    return outputs

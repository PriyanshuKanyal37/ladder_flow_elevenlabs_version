import json
import re
from typing import Any

from openai import OpenAI

from app.core.config import settings
from app.prompts.weekly_pack_prompts import SIGNAL_EXTRACTION_PROMPT
from app.services.post_count_decision import conversation_quality


VALID_SIGNAL_TYPES = {
    "strong_opinion",
    "story",
    "proof_point",
    "framework",
    "contrarian_take",
    "tactical_advice",
    "mistake_lesson",
    "founder_insight",
}


def _profile_context(user_profile: Any) -> str:
    if not user_profile:
        return "No saved profile."

    fields = {
        "target_audience": getattr(user_profile, "target_audience", None),
        "content_tone": getattr(user_profile, "content_tone", None),
        "primary_goal": getattr(user_profile, "primary_goal", None),
        "key_themes": getattr(user_profile, "key_themes", None),
        "platforms": getattr(user_profile, "platforms", None),
        "posting_frequency": getattr(user_profile, "posting_frequency", None),
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


def _clean_text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _clean_strength(value: Any) -> float:
    try:
        strength = float(value)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(1.0, strength))


def _signal_key(signal: dict[str, Any]) -> str:
    text = f"{signal.get('title', '')} {signal.get('summary', '')}".lower()
    return re.sub(r"[^a-z0-9]+", " ", text).strip()[:120]


def _validate_signals(raw_signals: Any) -> list[dict[str, Any]]:
    if not isinstance(raw_signals, list):
        return []

    validated: list[dict[str, Any]] = []
    seen_keys: set[str] = set()

    for raw_signal in raw_signals:
        if not isinstance(raw_signal, dict):
            continue

        signal_type = _clean_text(raw_signal.get("type"))
        title = _clean_text(raw_signal.get("title"))
        summary = _clean_text(raw_signal.get("summary"))
        source_quote = _clean_text(raw_signal.get("source_quote"))
        strength = _clean_strength(raw_signal.get("strength"))

        if signal_type not in VALID_SIGNAL_TYPES:
            continue
        if not title or not summary or not source_quote:
            continue
        if strength < 0.55:
            continue

        signal = {
            "type": signal_type,
            "title": title[:180],
            "summary": summary[:500],
            "source_quote": source_quote[:500],
            "strength": strength,
        }
        key = _signal_key(signal)
        if not key or key in seen_keys:
            continue

        seen_keys.add(key)
        validated.append(signal)

    validated.sort(key=lambda item: item["strength"], reverse=True)
    return validated


def _validate_theme_clusters(raw_clusters: Any, valid_titles: set[str]) -> list[dict[str, Any]]:
    if not isinstance(raw_clusters, list):
        return []

    clusters: list[dict[str, Any]] = []
    for raw_cluster in raw_clusters:
        if not isinstance(raw_cluster, dict):
            continue

        title = _clean_text(raw_cluster.get("title"))
        signal_titles = raw_cluster.get("signal_titles")
        if not title or not isinstance(signal_titles, list):
            continue

        cleaned_titles = [
            item.strip()
            for item in signal_titles
            if isinstance(item, str) and item.strip() in valid_titles
        ]
        if not cleaned_titles:
            continue

        clusters.append({
            "title": title[:180],
            "signal_titles": cleaned_titles[:8],
        })

    return clusters


def extract_content_signals(
    transcript: str,
    topic: str,
    user_profile: Any = None,
) -> dict[str, Any]:
    transcript = (transcript or "").strip()
    if len(transcript) < 100:
        return {
            "signals": [],
            "theme_clusters": [],
            "usable_signal_count": 0,
            "strong_signal_count": 0,
            "conversation_quality": "low",
        }

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    prompt = SIGNAL_EXTRACTION_PROMPT.format(
        topic=topic or "General Discussion",
        profile_context=_profile_context(user_profile),
        transcript=transcript,
    )

    completion = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": "Return only valid JSON. Extract transcript-grounded content signals without inventing claims.",
            },
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
        max_tokens=2500,
    )

    raw_content = completion.choices[0].message.content or "{}"
    parsed = _load_json_object(raw_content)
    signals = _validate_signals(parsed.get("signals"))
    valid_titles = {signal["title"] for signal in signals}
    theme_clusters = _validate_theme_clusters(parsed.get("theme_clusters"), valid_titles)

    usable_signal_count = len(signals)
    strong_signal_count = len([signal for signal in signals if signal["strength"] >= 0.75])

    return {
        "signals": signals,
        "theme_clusters": theme_clusters,
        "usable_signal_count": usable_signal_count,
        "strong_signal_count": strong_signal_count,
        "conversation_quality": conversation_quality(usable_signal_count, strong_signal_count),
    }

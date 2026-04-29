from typing import Any


DEFAULT_LINKEDIN_TARGET = 3
MAX_COUNTS = {
    "linkedin": 10,
    "x": 5,
    "newsletter": 3,
}


def _normalize_frequency(posting_frequency: str | None) -> str:
    if not posting_frequency:
        return ""
    return " ".join(posting_frequency.strip().lower().replace("×", "x").split())


def linkedin_target_from_frequency(posting_frequency: str | None) -> int:
    frequency = _normalize_frequency(posting_frequency)
    if not frequency:
        return DEFAULT_LINKEDIN_TARGET

    if frequency == "daily":
        return 5
    if "5x" in frequency or "5 x" in frequency:
        return 5
    if "4x" in frequency or "4 x" in frequency:
        return 4
    if "3x" in frequency or "3 x" in frequency:
        return 3
    if "2x" in frequency or "2 x" in frequency:
        return 2
    if "bi-weekly" in frequency or "biweekly" in frequency:
        return 1
    if "weekly" in frequency:
        return 1

    return DEFAULT_LINKEDIN_TARGET


def conversation_quality(usable_signal_count: int, strong_signal_count: int) -> str:
    if strong_signal_count >= 4 or usable_signal_count >= 7:
        return "high"
    if strong_signal_count >= 1 or usable_signal_count >= 3:
        return "medium"
    return "low"


def _theme_cluster_count(analysis: dict[str, Any]) -> int:
    clusters = analysis.get("theme_clusters") or []
    if not isinstance(clusters, list):
        return 0
    return len([cluster for cluster in clusters if isinstance(cluster, dict)])


def allowed_max_counts(analysis: dict[str, Any]) -> dict[str, int]:
    usable_signal_count = int(analysis.get("usable_signal_count") or 0)
    strong_signal_count = int(analysis.get("strong_signal_count") or 0)
    theme_cluster_count = _theme_cluster_count(analysis)

    newsletter_max = 0
    if usable_signal_count >= 3:
        newsletter_max = min(max(1, theme_cluster_count), MAX_COUNTS["newsletter"])

    return {
        "linkedin": min(usable_signal_count, MAX_COUNTS["linkedin"]),
        "x": min(strong_signal_count, MAX_COUNTS["x"]),
        "newsletter": newsletter_max,
    }


def recommend_counts(posting_frequency: str | None, analysis: dict[str, Any]) -> dict[str, int]:
    allowed = allowed_max_counts(analysis)
    linkedin_target = linkedin_target_from_frequency(posting_frequency)

    return {
        "linkedin": min(linkedin_target, allowed["linkedin"]),
        "x": min(allowed["x"], 1 if allowed["x"] > 0 else 0),
        "newsletter": min(allowed["newsletter"], 1 if allowed["newsletter"] > 0 else 0),
    }


def clamp_requested_counts(
    requested_counts: dict[str, Any] | None,
    max_counts: dict[str, int],
    allow_quality_override: bool = False,
) -> tuple[dict[str, int], list[str]]:
    requested_counts = requested_counts or {}
    final_counts: dict[str, int] = {}
    warnings: list[str] = []

    for platform in ("linkedin", "x", "newsletter"):
        raw_requested = requested_counts.get(platform, 0)
        try:
            requested = max(0, int(raw_requested))
        except (TypeError, ValueError):
            requested = 0

        quality_max = min(int(max_counts.get(platform, 0)), MAX_COUNTS[platform])
        platform_max = MAX_COUNTS[platform] if allow_quality_override else quality_max
        final_counts[platform] = min(requested, platform_max)

        if requested > platform_max:
            warnings.append(
                f"Requested {requested} {platform} outputs, but the hard limit is {platform_max}."
            )
        elif allow_quality_override and requested > quality_max:
            warnings.append(
                f"Requested {requested} {platform} outputs. Analysis only recommended {quality_max}, so these outputs may need extra editing."
            )

    return final_counts, warnings

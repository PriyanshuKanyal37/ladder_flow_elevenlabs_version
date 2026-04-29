from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from threading import Lock
from time import monotonic
from uuid import UUID

from fastapi import HTTPException


@dataclass(frozen=True)
class RateLimitPolicy:
    limit: int
    window_seconds: int


POLICIES: dict[str, RateLimitPolicy] = {
    "voice_start": RateLimitPolicy(limit=8, window_seconds=10 * 60),
    "content_pack_generate": RateLimitPolicy(limit=6, window_seconds=15 * 60),
    "content_output_regenerate": RateLimitPolicy(limit=12, window_seconds=15 * 60),
    "research": RateLimitPolicy(limit=10, window_seconds=60 * 60),
    "brain_chat": RateLimitPolicy(limit=40, window_seconds=60 * 60),
    "legacy_social_generate": RateLimitPolicy(limit=12, window_seconds=60 * 60),
}

_hits: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()


def check_rate_limit(user_id: UUID | str, action: str) -> None:
    policy = POLICIES.get(action)
    if not policy:
        return

    now = monotonic()
    cutoff = now - policy.window_seconds
    key = f"{action}:{user_id}"

    with _lock:
        timestamps = _hits[key]
        while timestamps and timestamps[0] <= cutoff:
            timestamps.popleft()

        if len(timestamps) >= policy.limit:
            retry_after = max(1, int(policy.window_seconds - (now - timestamps[0])))
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "rate_limited",
                    "message": "Too many requests. Please wait before trying again.",
                    "action": action,
                    "limit": policy.limit,
                    "window_seconds": policy.window_seconds,
                    "retry_after_seconds": retry_after,
                },
                headers={"Retry-After": str(retry_after)},
            )

        timestamps.append(now)

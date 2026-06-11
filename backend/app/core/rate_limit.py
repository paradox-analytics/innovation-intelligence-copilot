from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request
from redis.asyncio import Redis

from app.core.config import settings
from app.core.exceptions import RateLimitError


@dataclass(frozen=True)
class RateLimitConfig:
    """Configuration for a rate limit rule."""

    max_requests: int
    window_seconds: int


# Default presets
DEFAULT_RATE_LIMIT = RateLimitConfig(max_requests=100, window_seconds=60)
ANALYSIS_RATE_LIMIT = RateLimitConfig(max_requests=10, window_seconds=60)


class RateLimiter:
    """Redis-backed sliding window rate limiter."""

    def __init__(self, redis_url: str = settings.REDIS_URL) -> None:
        self._redis: Redis = Redis.from_url(redis_url, decode_responses=True)  # type: ignore[assignment]

    async def close(self) -> None:
        """Close the Redis connection."""
        await self._redis.close()

    async def check(
        self,
        key: str,
        config: RateLimitConfig,
    ) -> tuple[bool, int, int]:
        """Check whether the request is within the rate limit.

        Returns (allowed, remaining, retry_after_seconds).
        Uses a sliding window with sorted sets.
        """
        now = time.time()
        window_start = now - config.window_seconds

        pipe = self._redis.pipeline()
        # Remove entries older than the sliding window
        pipe.zremrangebyscore(key, 0, window_start)
        # Add current request
        pipe.zadd(key, {str(now): now})
        # Count entries in the window
        pipe.zcard(key)
        # Set TTL to auto-expire the key
        pipe.expire(key, config.window_seconds)

        results = await pipe.execute()
        request_count: int = results[2]

        remaining = max(0, config.max_requests - request_count)
        allowed = request_count <= config.max_requests

        if not allowed:
            # Calculate retry-after from the oldest entry in the window
            oldest_entries = await self._redis.zrange(key, 0, 0, withscores=True)
            if oldest_entries:
                oldest_ts = oldest_entries[0][1]
                retry_after = int(oldest_ts + config.window_seconds - now) + 1
            else:
                retry_after = config.window_seconds
            return False, 0, retry_after

        return True, remaining, 0


# Module-level singleton — created lazily on first use
_limiter: RateLimiter | None = None


def _get_limiter() -> RateLimiter:
    global _limiter
    if _limiter is None:
        _limiter = RateLimiter()
    return _limiter


def _client_key(request: Request) -> str:
    """Derive a rate-limit key from the request (user ID or IP)."""
    # If the user is authenticated, use their user ID
    user = getattr(request.state, "current_user", None)
    if user is not None:
        identifier = getattr(user, "id", None)
        if identifier:
            return f"rl:user:{identifier}"

    # Fall back to client IP
    client_ip = request.client.host if request.client else "unknown"
    return f"rl:ip:{client_ip}"


def rate_limit(config: RateLimitConfig = DEFAULT_RATE_LIMIT):
    """Return a FastAPI dependency that enforces the given rate limit."""

    async def _dependency(request: Request) -> None:
        limiter = _get_limiter()
        key = _client_key(request) + f":{request.url.path}"

        allowed, remaining, retry_after = await limiter.check(key, config)

        if not allowed:
            raise RateLimitError(
                message="Rate limit exceeded. Please try again later.",
                details={
                    "retry_after_seconds": retry_after,
                    "limit": config.max_requests,
                    "window_seconds": config.window_seconds,
                },
            )

        # Attach rate-limit headers via request state for middleware to pick up
        request.state.rate_limit_remaining = remaining
        request.state.rate_limit_limit = config.max_requests

    return _dependency


# Convenience typed dependencies
RateLimitDefault = Annotated[None, Depends(rate_limit(DEFAULT_RATE_LIMIT))]
RateLimitAnalysis = Annotated[None, Depends(rate_limit(ANALYSIS_RATE_LIMIT))]

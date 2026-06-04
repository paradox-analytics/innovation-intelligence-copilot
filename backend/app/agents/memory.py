"""Agent memory and context management with Redis-backed storage."""

from __future__ import annotations

import hashlib
import json
import logging
import time
from dataclasses import asdict, dataclass, field

import redis.asyncio as redis

from app.core.config import settings

logger = logging.getLogger(__name__)

_DEFAULT_TTL_SECONDS = 3600 * 24  # 24 hours
_MAX_CONTEXTS_PER_TOPIC = 20
_NAMESPACE = "agent_memory"


@dataclass
class StoredContext:
    """A single stored analysis context entry."""

    topic: str
    agent_name: str
    query: str
    result_summary: str
    confidence: float
    timestamp: float
    metadata: dict[str, object] = field(default_factory=dict)


class ConversationMemory:
    """Stores past analysis contexts so agents can reference prior analyses
    for the same or related topics.

    Backed by Redis with configurable TTL.  Each topic gets a sorted set keyed
    by timestamp so that recent contexts surface first.
    """

    def __init__(
        self,
        redis_url: str | None = None,
        ttl_seconds: int = _DEFAULT_TTL_SECONDS,
        namespace: str = _NAMESPACE,
    ) -> None:
        self._redis_url = redis_url or settings.REDIS_URL
        self._ttl = ttl_seconds
        self._namespace = namespace
        self._client: redis.Redis | None = None

    async def _get_client(self) -> redis.Redis:
        if self._client is None:
            self._client = redis.from_url(
                self._redis_url, decode_responses=True
            )
        return self._client

    def _topic_key(self, topic: str) -> str:
        """Deterministic Redis key for a topic's context list."""
        slug = hashlib.sha256(topic.lower().strip().encode()).hexdigest()[:16]
        return f"{self._namespace}:topic:{slug}"

    def _detail_key(self, context_id: str) -> str:
        """Redis key for the full context payload."""
        return f"{self._namespace}:ctx:{context_id}"

    @staticmethod
    def _make_context_id(topic: str, agent_name: str, timestamp: float) -> str:
        raw = f"{topic}:{agent_name}:{timestamp}"
        return hashlib.sha256(raw.encode()).hexdigest()[:24]

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def store_context(
        self,
        topic: str,
        agent_name: str,
        query: str,
        result_summary: str,
        confidence: float,
        metadata: dict[str, object] | None = None,
    ) -> str:
        """Persist an analysis context for later retrieval.

        Returns the generated context ID.
        """
        client = await self._get_client()
        now = time.time()
        context_id = self._make_context_id(topic, agent_name, now)

        ctx = StoredContext(
            topic=topic,
            agent_name=agent_name,
            query=query,
            result_summary=result_summary,
            confidence=confidence,
            timestamp=now,
            metadata=metadata or {},
        )

        pipeline = client.pipeline(transaction=True)

        # Store full payload
        detail_key = self._detail_key(context_id)
        pipeline.set(detail_key, json.dumps(asdict(ctx)), ex=self._ttl)

        # Add to topic's sorted set (score = timestamp)
        topic_key = self._topic_key(topic)
        pipeline.zadd(topic_key, {context_id: now})
        pipeline.expire(topic_key, self._ttl)

        # Trim to keep only the most recent entries
        pipeline.zremrangebyrank(topic_key, 0, -(_MAX_CONTEXTS_PER_TOPIC + 1))

        await pipeline.execute()

        logger.info(
            "Stored context %s for topic=%s agent=%s",
            context_id,
            topic,
            agent_name,
        )
        return context_id

    async def retrieve_relevant_context(
        self,
        topic: str,
        limit: int = 5,
    ) -> list[StoredContext]:
        """Retrieve the most recent stored contexts for *topic*, newest first."""
        client = await self._get_client()
        topic_key = self._topic_key(topic)

        # Get the latest `limit` context IDs (highest scores = most recent)
        context_ids: list[str] = await client.zrevrange(topic_key, 0, limit - 1)

        if not context_ids:
            return []

        # Fetch full payloads
        detail_keys = [self._detail_key(cid) for cid in context_ids]
        raw_values: list[str | None] = await client.mget(detail_keys)

        contexts: list[StoredContext] = []
        for raw in raw_values:
            if raw is None:
                continue
            data: dict[str, object] = json.loads(raw)
            contexts.append(
                StoredContext(
                    topic=str(data["topic"]),
                    agent_name=str(data["agent_name"]),
                    query=str(data["query"]),
                    result_summary=str(data["result_summary"]),
                    confidence=float(data.get("confidence", 0.0)),
                    timestamp=float(data.get("timestamp", 0.0)),
                    metadata=dict(data.get("metadata", {})),  # type: ignore[arg-type]
                )
            )

        return contexts

    async def clear_context(self, topic: str) -> int:
        """Remove all stored contexts for *topic*.

        Returns the number of context entries deleted.
        """
        client = await self._get_client()
        topic_key = self._topic_key(topic)

        context_ids: list[str] = await client.zrange(topic_key, 0, -1)
        if not context_ids:
            return 0

        detail_keys = [self._detail_key(cid) for cid in context_ids]

        pipeline = client.pipeline(transaction=True)
        pipeline.delete(topic_key)
        for dk in detail_keys:
            pipeline.delete(dk)
        await pipeline.execute()

        deleted = len(context_ids)
        logger.info("Cleared %d contexts for topic=%s", deleted, topic)
        return deleted

    async def close(self) -> None:
        """Shut down the Redis connection."""
        if self._client is not None:
            await self._client.close()
            self._client = None

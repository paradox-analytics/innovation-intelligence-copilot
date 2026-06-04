from __future__ import annotations

import asyncio
import enum
import json
import logging
import time
from dataclasses import asdict, dataclass, field
from typing import Callable, Coroutine
from uuid import uuid4

from redis.asyncio import Redis

from app.core.config import settings

logger = logging.getLogger("app.tasks")


class TaskStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


@dataclass
class TaskInfo:
    """Metadata about a queued task."""

    task_id: str
    task_type: str
    status: TaskStatus
    payload: dict[str, object] = field(default_factory=dict)
    result: dict[str, object] | None = None
    error: str | None = None
    created_at: float = field(default_factory=time.time)
    started_at: float | None = None
    completed_at: float | None = None

    def to_dict(self) -> dict[str, object]:
        data = asdict(self)
        data["status"] = self.status.value
        return data

    @classmethod
    def from_dict(cls, data: dict[str, object]) -> TaskInfo:
        data["status"] = TaskStatus(data["status"])
        return cls(**data)  # type: ignore[arg-type]


# Key prefixes for Redis
_QUEUE_KEY = "tasks:queue"
_TASK_PREFIX = "tasks:info:"


class TaskQueue:
    """Redis-backed async task queue with status tracking."""

    def __init__(self, redis_url: str = settings.REDIS_URL) -> None:
        self._redis: Redis = Redis.from_url(redis_url, decode_responses=True)  # type: ignore[assignment]
        self._handlers: dict[str, Callable[..., Coroutine[object, object, dict[str, object]]]] = {}
        self._running = False

    async def close(self) -> None:
        """Close the Redis connection."""
        await self._redis.close()

    # ------------------------------------------------------------------
    # Handler registration
    # ------------------------------------------------------------------

    def register(
        self,
        task_type: str,
        handler: Callable[..., Coroutine[object, object, dict[str, object]]],
    ) -> None:
        """Register an async handler function for a given task type."""
        self._handlers[task_type] = handler

    # ------------------------------------------------------------------
    # Enqueue
    # ------------------------------------------------------------------

    async def enqueue(
        self,
        task_type: str,
        payload: dict[str, object] | None = None,
    ) -> TaskInfo:
        """Add a task to the queue and persist its metadata."""
        task = TaskInfo(
            task_id=uuid4().hex,
            task_type=task_type,
            status=TaskStatus.QUEUED,
            payload=payload or {},
        )

        # Store task info
        await self._redis.set(
            f"{_TASK_PREFIX}{task.task_id}",
            json.dumps(task.to_dict()),
        )

        # Push task ID to the queue
        await self._redis.rpush(_QUEUE_KEY, task.task_id)

        logger.info("task_enqueued task_id=%s type=%s", task.task_id, task_type)
        return task

    # ------------------------------------------------------------------
    # Status tracking
    # ------------------------------------------------------------------

    async def get_task(self, task_id: str) -> TaskInfo | None:
        """Retrieve current task info by ID."""
        raw = await self._redis.get(f"{_TASK_PREFIX}{task_id}")
        if raw is None:
            return None
        return TaskInfo.from_dict(json.loads(raw))

    async def update_task(self, task: TaskInfo) -> None:
        """Persist updated task info."""
        await self._redis.set(
            f"{_TASK_PREFIX}{task.task_id}",
            json.dumps(task.to_dict()),
        )

    # ------------------------------------------------------------------
    # Worker loop
    # ------------------------------------------------------------------

    async def start_worker(self, poll_interval: float = 1.0) -> None:
        """Run the worker loop that processes tasks from the queue.

        This should be called as a background task in the application lifespan.
        """
        self._running = True
        logger.info("task_worker_started")

        while self._running:
            # Blocking pop with timeout (returns None on timeout)
            result = await self._redis.blpop(_QUEUE_KEY, timeout=int(poll_interval))

            if result is None:
                continue

            _queue_name, task_id = result
            await self._process_task(str(task_id))

    async def stop_worker(self) -> None:
        """Signal the worker loop to stop."""
        self._running = False
        logger.info("task_worker_stopping")

    async def _process_task(self, task_id: str) -> None:
        """Process a single task by invoking its registered handler."""
        task = await self.get_task(task_id)
        if task is None:
            logger.warning("task_not_found task_id=%s", task_id)
            return

        handler = self._handlers.get(task.task_type)
        if handler is None:
            logger.error("no_handler_registered task_type=%s", task.task_type)
            task.status = TaskStatus.FAILED
            task.error = f"No handler registered for task type: {task.task_type}"
            task.completed_at = time.time()
            await self.update_task(task)
            return

        # Mark as running
        task.status = TaskStatus.RUNNING
        task.started_at = time.time()
        await self.update_task(task)

        try:
            result = await handler(task.payload)
            task.status = TaskStatus.COMPLETED
            task.result = result
            task.completed_at = time.time()
            logger.info(
                "task_completed task_id=%s duration_ms=%.1f",
                task_id,
                (task.completed_at - (task.started_at or task.created_at)) * 1000,
            )
        except Exception as exc:
            task.status = TaskStatus.FAILED
            task.error = str(exc)
            task.completed_at = time.time()
            logger.exception("task_failed task_id=%s", task_id)
        finally:
            await self.update_task(task)


# ---------------------------------------------------------------------------
# Module-level convenience
# ---------------------------------------------------------------------------

_task_queue: TaskQueue | None = None


def get_task_queue() -> TaskQueue:
    """Return the global TaskQueue singleton, creating it if needed."""
    global _task_queue  # noqa: PLW0603
    if _task_queue is None:
        _task_queue = TaskQueue()
    return _task_queue


async def enqueue_analysis(
    analysis_id: str,
    query: str,
    context: dict[str, object] | None = None,
) -> TaskInfo:
    """Convenience function to enqueue an analysis request for background processing."""
    queue = get_task_queue()
    return await queue.enqueue(
        task_type="analysis",
        payload={
            "analysis_id": analysis_id,
            "query": query,
            "context": context or {},
        },
    )

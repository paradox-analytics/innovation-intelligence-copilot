"""SSE streaming endpoint for real-time analysis progress."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, datetime

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/analyze", tags=["streaming"])

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# In-memory event store (production: replace with Redis pub/sub)
# ---------------------------------------------------------------------------

# analysis_id -> asyncio.Queue of SSE events
_event_queues: dict[str, asyncio.Queue[dict[str, object] | None]] = {}


def get_event_queue(analysis_id: str) -> asyncio.Queue[dict[str, object] | None]:
    """Get or create an event queue for an analysis run."""
    if analysis_id not in _event_queues:
        _event_queues[analysis_id] = asyncio.Queue()
    return _event_queues[analysis_id]


def cleanup_queue(analysis_id: str) -> None:
    """Remove the event queue after streaming completes."""
    _event_queues.pop(analysis_id, None)


async def emit_event(
    analysis_id: str,
    event_type: str,
    data: dict[str, object],
) -> None:
    """Push an event to the analysis's SSE queue.

    Called by the orchestrator or agent nodes as they start/complete.
    """
    queue = get_event_queue(analysis_id)
    event: dict[str, object] = {
        "event": event_type,
        "timestamp": datetime.now(UTC).isoformat(),
        **data,
    }
    await queue.put(event)


async def emit_agent_started(analysis_id: str, agent_name: str) -> None:
    """Convenience: emit an agent-started event."""
    await emit_event(
        analysis_id,
        "agent_started",
        {"agent": agent_name, "status": "started"},
    )


async def emit_agent_completed(
    analysis_id: str,
    agent_name: str,
    partial_result: dict[str, object] | None = None,
) -> None:
    """Convenience: emit an agent-completed event with optional partial result."""
    data: dict[str, object] = {"agent": agent_name, "status": "completed"}
    if partial_result is not None:
        data["partial_result"] = partial_result
    await emit_event(analysis_id, "agent_completed", data)


async def emit_analysis_complete(
    analysis_id: str,
    result: dict[str, object],
) -> None:
    """Emit the final analysis result and signal stream end."""
    await emit_event(
        analysis_id,
        "analysis_complete",
        {"status": "completed", "result": result},
    )
    # Sentinel to close the stream
    queue = get_event_queue(analysis_id)
    await queue.put(None)


async def emit_analysis_error(analysis_id: str, error: str) -> None:
    """Emit an error event and signal stream end."""
    await emit_event(
        analysis_id,
        "analysis_error",
        {"status": "failed", "error": error},
    )
    queue = get_event_queue(analysis_id)
    await queue.put(None)


# ---------------------------------------------------------------------------
# SSE endpoint
# ---------------------------------------------------------------------------


@router.get(
    "/{analysis_id}/stream",
    summary="Stream analysis progress via Server-Sent Events",
    response_class=StreamingResponse,
)
async def stream_analysis(analysis_id: str) -> StreamingResponse:
    """Server-Sent Events stream for an analysis run.

    Emits events as each agent starts and completes, partial results as they
    become available, and a final event with the complete analysis result.

    Event format (one per line group):
        event: <event_type>
        data: {"agent": "research", "status": "started", "timestamp": "..."}
    """
    queue = get_event_queue(analysis_id)

    async def event_generator():  # type: ignore[no-untyped-def]
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=300)
                except TimeoutError:
                    # Send a keep-alive comment
                    yield ": keepalive\n\n"
                    continue

                if event is None:
                    # Stream complete
                    yield "event: done\ndata: {}\n\n"
                    break

                event_type = str(event.get("event", "message"))
                payload = json.dumps(event, default=str)
                yield f"event: {event_type}\ndata: {payload}\n\n"

        finally:
            cleanup_queue(analysis_id)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

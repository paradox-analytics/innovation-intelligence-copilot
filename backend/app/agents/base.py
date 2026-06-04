from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from datetime import datetime, timezone

import anthropic

from app.core.config import settings
from app.models import AgentInput, AgentOutput, AgentTrace

logger = logging.getLogger(__name__)

# Defaults not already in the global Settings
_DEFAULT_MODEL = "claude-sonnet-4-6"
_DEFAULT_TIMEOUT_SECONDS = 120


class BaseAgent(ABC):
    """All agents inherit from this to get tracing, logging, and a shared Claude client."""

    name: str = "base"
    description: str = ""

    def __init__(self, model: str | None = None) -> None:
        self.model = model or _DEFAULT_MODEL
        self._client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    @abstractmethod
    async def _run(self, input_data: AgentInput) -> dict[str, object]:
        ...

    async def execute(self, input_data: AgentInput) -> AgentOutput:
        started = datetime.now(timezone.utc)
        start_ns = time.perf_counter_ns()
        error: str | None = None
        result: dict[str, object] = {}

        try:
            result = await self._run(input_data)
        except Exception as exc:
            error = str(exc)
            logger.exception("Agent %s failed", self.name)

        duration_ms = (time.perf_counter_ns() - start_ns) / 1_000_000
        finished = datetime.now(timezone.utc)

        trace = AgentTrace(
            agent_name=self.name,
            started_at=started.isoformat(),
            finished_at=finished.isoformat(),
            duration_ms=duration_ms,
            error=error,
        )

        return AgentOutput(agent_name=self.name, result=result, trace=trace)

    async def _ask_claude(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 4096,
    ) -> str:
        response = await self._client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return response.content[0].text

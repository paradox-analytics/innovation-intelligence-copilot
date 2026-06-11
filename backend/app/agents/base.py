from __future__ import annotations

import json
import logging
import time
from abc import ABC, abstractmethod
from datetime import UTC, datetime

import anthropic
from anthropic.types import TextBlock

from app.core.config import settings
from app.core.usage import log_usage
from app.models import AgentInput, AgentOutput, AgentTrace

logger = logging.getLogger(__name__)

# Default extraction-agent model (cheap); overridable per-agent and via settings.
_DEFAULT_MODEL = settings.AGENT_MODEL
_DEFAULT_TIMEOUT_SECONDS = 120


class BaseAgent(ABC):
    """All agents inherit from this to get tracing, logging, and a shared Claude client."""

    name: str = "base"
    description: str = ""

    def __init__(self, model: str | None = None) -> None:
        self.model = model or _DEFAULT_MODEL
        self._client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    @abstractmethod
    async def _run(self, input_data: AgentInput) -> dict[str, object]: ...

    async def execute(self, input_data: AgentInput) -> AgentOutput:
        started = datetime.now(UTC)
        start_ns = time.perf_counter_ns()
        error: str | None = None
        result: dict[str, object] = {}

        try:
            result = await self._run(input_data)
        except Exception as exc:
            error = str(exc)
            logger.exception("Agent %s failed", self.name)

        duration_ms = (time.perf_counter_ns() - start_ns) / 1_000_000
        finished = datetime.now(UTC)

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
        log_usage(logger, self.name, self.model, response.usage)
        block = response.content[0]
        return block.text if isinstance(block, TextBlock) else ""

    @staticmethod
    def _parse_json(raw: str, default: object) -> object:
        """Parse a JSON blob from a model response, tolerating markdown fences."""
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[-1]
            if text.rstrip().endswith("```"):
                text = text.rsplit("```", 1)[0]
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            for opener, closer in (("[", "]"), ("{", "}")):
                start, end = text.find(opener), text.rfind(closer)
                if 0 <= start < end:
                    try:
                        return json.loads(text[start : end + 1])
                    except json.JSONDecodeError:
                        continue
            logger.warning("agent JSON parse failed; using default")
            return default

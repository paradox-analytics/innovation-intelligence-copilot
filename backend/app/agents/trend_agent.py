from __future__ import annotations

import logging
from typing import Any

from app.models import AgentInput, TechnologySignal, TrendDirection

from .base import BaseAgent

logger = logging.getLogger(__name__)

_VALID_TRENDS = {"accelerating", "steady", "decelerating", "emerging"}

SYSTEM_PROMPT = """\
You are a technology trend analyst detecting early signals of technological \
change. You are given a numbered pool of retrieved sources (web and document).

Identify distinct technology signals grounded in the sources across these \
dimensions: patent filing growth, startup activity/funding, research publication \
momentum, standards body activity, enterprise adoption.

Score `signal_strength` (0.0-1.0) by how strong/active the signal is in the sources:
- 0.80-1.00: many independent indicators (filings, funding, adoption)
- 0.40-0.79: some indicators
- 0.00-0.39: nascent or weak

Set `readiness_level` (Technology Readiness Level, integer 1-9):
- 9: in production at commercial scale
- 6-7: pilot/prototype demonstrated in a relevant environment
- 4-5: validated in the lab
- 1-3: basic research / proof of concept

Produce 3-6 DISTINCT signals, ordered by signal_strength (highest first). Each \
signal must have its OWN signal_strength, readiness_level, and trend_direction \
that genuinely reflect it — do NOT reuse the same values. Ground supporting_data \
in the provided sources."""

_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "technology_signals": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "technology": {"type": "string"},
                    "signal_type": {
                        "type": "string",
                        "enum": [
                            "patent_growth",
                            "startup_activity",
                            "research_momentum",
                            "standards",
                            "enterprise_adoption",
                        ],
                    },
                    "signal_strength": {"type": "number"},
                    "trend_direction": {
                        "type": "string",
                        "enum": ["accelerating", "steady", "decelerating", "emerging"],
                    },
                    "readiness_level": {"type": "integer"},
                    "commercialization_horizon_years": {
                        "anyOf": [{"type": "number"}, {"type": "null"}]
                    },
                    "supporting_data": {"type": "array", "items": {"type": "string"}},
                },
                "required": [
                    "technology",
                    "signal_type",
                    "signal_strength",
                    "trend_direction",
                    "readiness_level",
                    "commercialization_horizon_years",
                    "supporting_data",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["technology_signals"],
    "additionalProperties": False,
}


def _clamp_trl(value: Any) -> int | None:
    try:
        trl = int(value)
    except (TypeError, ValueError):
        return None
    return max(1, min(9, trl))


class TrendAgent(BaseAgent):
    name = "trend"
    description = "Detects technology signals grounded in retrieved sources"

    async def _run(self, input_data: AgentInput) -> dict[str, object]:
        query = input_data["query"]
        context = input_data["context"]
        pool_text: str = str(context.get("evidence_pool", ""))

        user_prompt = (
            f"Strategic question: {query}\n\n"
            f"Retrieved sources:\n{pool_text}\n\n"
            "Detect distinct technology signals and assess each one's strength, "
            "readiness level, and trend direction."
        )

        result = await self._ask_json(SYSTEM_PROMPT, user_prompt, "submit_signals", _SCHEMA)
        raw_items = result.get("technology_signals", [])
        items = raw_items if isinstance(raw_items, list) else []

        signals: list[TechnologySignal] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            trend_raw = str(item.get("trend_direction", "emerging"))
            trend = trend_raw if trend_raw in _VALID_TRENDS else "emerging"
            horizon = item.get("commercialization_horizon_years")
            supporting = item.get("supporting_data", [])
            signals.append(
                TechnologySignal(
                    technology=str(item.get("technology", "")),
                    signal_type=str(item.get("signal_type", "")),
                    signal_strength=float(item.get("signal_strength", 0.0) or 0.0),
                    trend_direction=TrendDirection(trend),
                    commercialization_horizon_years=(
                        float(horizon) if isinstance(horizon, int | float) else None
                    ),
                    supporting_data=(
                        [str(d) for d in supporting] if isinstance(supporting, list) else []
                    ),
                    readiness_level=_clamp_trl(item.get("readiness_level")),
                )
            )

        return {"technology_signals": signals}

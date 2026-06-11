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

Return a JSON array:
[
  {
    "technology": "specific technology or trend name",
    "signal_type": "patent_growth | startup_activity | research_momentum | standards | enterprise_adoption",
    "signal_strength": 0.0-1.0,
    "trend_direction": "accelerating | steady | decelerating | emerging",
    "readiness_level": 1-9,
    "commercialization_horizon_years": null | number,
    "supporting_data": ["concrete data point from a source", "..."]
  }
]

Produce 3-6 DISTINCT signals. Each must have its own signal_strength, \
readiness_level (Technology Readiness Level 1-9), and trend_direction that \
genuinely reflect that signal — do NOT reuse the same values across signals. \
Ground supporting_data in the provided sources. Return valid JSON only, no markdown fences."""


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

        raw = await self._ask_claude(SYSTEM_PROMPT, user_prompt)
        parsed = self._parse_json(raw, [])
        items: list[dict[str, Any]] = parsed if isinstance(parsed, list) else []

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
                        float(horizon) if isinstance(horizon, (int, float)) else None
                    ),
                    supporting_data=(
                        [str(d) for d in supporting] if isinstance(supporting, list) else []
                    ),
                    readiness_level=_clamp_trl(item.get("readiness_level")),
                )
            )

        return {"technology_signals": signals}

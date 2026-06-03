from __future__ import annotations

import json
import logging

from app.models import AgentInput, TechnologySignal, TrendDirection

from .base import BaseAgent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a technology trend analyst specializing in detecting early signals of \
technological change. Analyze the following evidence for technology signals:
- Patent filing growth
- Startup activity and funding trends
- Research publication momentum
- Standards body activity
- Enterprise adoption indicators

Return a JSON array:
[
  {
    "technology": "technology name",
    "signal_type": "patent_growth" | "startup_activity" | "research_momentum" | "standards" | "enterprise_adoption",
    "signal_strength": 0.0-1.0,
    "trend_direction": "accelerating" | "steady" | "decelerating" | "emerging",
    "commercialization_horizon_years": null | number,
    "supporting_data": ["data point 1", "data point 2"]
  }
]

Return valid JSON only, no markdown fences."""


class TrendAgent(BaseAgent):
    name = "trend"
    description = "Detects technology signals and trend indicators"

    async def _run(self, input_data: AgentInput) -> dict[str, object]:
        query = input_data["query"]
        context = input_data["context"]
        research_evidence: list[dict[str, object]] = context.get("research_evidence", [])  # type: ignore[assignment]
        graph_signals: list[dict[str, object]] = context.get("graph_signals", [])  # type: ignore[assignment]

        evidence_text = "\n".join(
            f"- {e.get('claim', '')} (confidence: {e.get('confidence', 0)})"
            for e in research_evidence
        )

        graph_text = ""
        if graph_signals:
            graph_text = "\n\nKnowledge graph signals:\n" + "\n".join(
                f"- {s.get('description', '')}" for s in graph_signals
            )

        user_prompt = (
            f"Strategic question: {query}\n\n"
            f"Research evidence:\n{evidence_text}"
            f"{graph_text}\n\n"
            "Detect technology signals and assess trend directions."
        )

        raw = await self._ask_claude(SYSTEM_PROMPT, user_prompt)
        parsed: list[dict[str, object]] = json.loads(raw)

        signals: list[TechnologySignal] = []
        for item in parsed:
            horizon = item.get("commercialization_horizon_years")
            signals.append(
                TechnologySignal(
                    technology=str(item.get("technology", "")),
                    signal_type=str(item.get("signal_type", "")),
                    signal_strength=float(item.get("signal_strength", 0.0)),
                    trend_direction=TrendDirection(
                        item.get("trend_direction", "emerging")
                    ),
                    commercialization_horizon_years=(
                        float(horizon) if horizon is not None else None
                    ),
                    supporting_data=[str(d) for d in item.get("supporting_data", [])],  # type: ignore[union-attr]
                )
            )

        return {"technology_signals": signals}

from __future__ import annotations

import json
import logging
from dataclasses import asdict

from app.models import (
    AgentInput,
    AnalysisResult,
    Evidence,
    RiskItem,
    TechnologySignal,
)

from .base import BaseAgent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a chief technology strategist synthesizing multiple analyst perspectives \
into a final recommendation for an enterprise executive audience.

You will receive:
- Supporting evidence
- Contrarian evidence / challenged assumptions
- Risk assessment
- Technology signals

Produce a JSON object:
{
  "recommendation": "ADOPT" | "TRIAL" | "ASSESS" | "HOLD" | "AVOID",
  "confidence_score": 0-100,
  "executive_summary": "2-3 paragraph executive summary",
  "key_assumptions": ["assumption 1", "assumption 2"]
}

The confidence_score reflects how confident you are in the recommendation, \
accounting for evidence quality, risk severity, and trend signals.

Return valid JSON only, no markdown fences."""


def _serialize_evidence(items: list[Evidence]) -> list[dict[str, object]]:
    return [asdict(e) for e in items]


def _serialize_risks(items: list[RiskItem]) -> list[dict[str, object]]:
    return [asdict(r) for r in items]


def _serialize_signals(items: list[TechnologySignal]) -> list[dict[str, object]]:
    return [asdict(s) for s in items]


class ExecutiveAgent(BaseAgent):
    name = "executive"
    description = "Synthesizes all agent outputs into a final recommendation"

    async def _run(self, input_data: AgentInput) -> dict[str, object]:
        query = input_data["query"]
        context = input_data["context"]

        supporting: list[Evidence] = context.get("supporting_evidence", [])  # type: ignore[assignment]
        contrarian: list[Evidence] = context.get("contrarian_evidence", [])  # type: ignore[assignment]
        risks: list[RiskItem] = context.get("risks", [])  # type: ignore[assignment]
        signals: list[TechnologySignal] = context.get("technology_signals", [])  # type: ignore[assignment]
        challenged: list[str] = context.get("challenged_assumptions", [])  # type: ignore[assignment]

        user_prompt = (
            f"Strategic question: {query}\n\n"
            f"Supporting evidence:\n{json.dumps(_serialize_evidence(supporting), indent=2, default=str)}\n\n"
            f"Contrarian evidence:\n{json.dumps(_serialize_evidence(contrarian), indent=2, default=str)}\n\n"
            f"Challenged assumptions:\n{json.dumps(challenged, indent=2)}\n\n"
            f"Risk assessment:\n{json.dumps(_serialize_risks(risks), indent=2, default=str)}\n\n"
            f"Technology signals:\n{json.dumps(_serialize_signals(signals), indent=2, default=str)}\n\n"
            "Synthesize into a final recommendation."
        )

        raw = await self._ask_claude(SYSTEM_PROMPT, user_prompt, max_tokens=4096)
        parsed: dict[str, object] = json.loads(raw)

        result = AnalysisResult(
            query=query,
            recommendation=str(parsed.get("recommendation", "")),
            confidence_score=int(parsed.get("confidence_score", 0)),  # type: ignore[arg-type]
            executive_summary=str(parsed.get("executive_summary", "")),
            supporting_evidence=supporting,
            contrarian_evidence=contrarian,
            risks=risks,
            key_assumptions=[str(a) for a in parsed.get("key_assumptions", [])],  # type: ignore[union-attr]
            technology_signals=signals,
        )

        return {"analysis_result": result}

from __future__ import annotations

import json
import logging
from dataclasses import asdict
from typing import Any

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

You will receive supporting evidence, contrarian evidence / challenged \
assumptions, a risk assessment, and technology signals.

Choose `recommendation` from: ADOPT, TRIAL, ASSESS, HOLD, AVOID.

Set `confidence_score` (0-100) in the recommendation, weighing evidence quality, \
risk severity, and signal strength:
- 80-100: strong, consistent supporting evidence; low or manageable risks
- 50-79: mixed evidence or moderate risks
- 0-49: weak/conflicting evidence or severe risks

Write a factual 2-3 paragraph executive_summary grounded ONLY in the inputs \
provided; do not introduce facts they do not support."""

_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "recommendation": {
            "type": "string",
            "enum": ["ADOPT", "TRIAL", "ASSESS", "HOLD", "AVOID"],
        },
        "confidence_score": {"type": "integer"},
        "executive_summary": {"type": "string"},
        "key_assumptions": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "recommendation",
        "confidence_score",
        "executive_summary",
        "key_assumptions",
    ],
    "additionalProperties": False,
}


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

        parsed = await self._ask_json(SYSTEM_PROMPT, user_prompt, "submit_recommendation", _SCHEMA)

        try:
            confidence_score = int(parsed.get("confidence_score", 0))
        except (TypeError, ValueError):
            confidence_score = 0

        result = AnalysisResult(
            query=query,
            recommendation=str(parsed.get("recommendation", "")),
            confidence_score=confidence_score,
            executive_summary=str(parsed.get("executive_summary", "")),
            supporting_evidence=supporting,
            contrarian_evidence=contrarian,
            risks=risks,
            key_assumptions=[str(a) for a in parsed.get("key_assumptions", [])],
            technology_signals=signals,
        )

        return {"analysis_result": result}

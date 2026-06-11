from __future__ import annotations

import logging
from typing import Any

from app.models import AgentInput, Likelihood, RiskCategory, RiskItem, Severity

from .base import BaseAgent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a technology risk analyst. You are given a strategic question and a \
numbered pool of retrieved sources (web and document). Identify strategic, \
technical, market, and regulatory risks grounded in those sources.

Use these severity definitions consistently:
- critical: could end the initiative or cause major loss
- high: materially threatens timeline, cost, or viability
- medium: meaningful but manageable
- low: minor

Order risks by severity (critical first), then by likelihood. Be specific."""

_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "risks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "description": {"type": "string"},
                    "category": {
                        "type": "string",
                        "enum": ["strategic", "technical", "market", "regulatory"],
                    },
                    "severity": {
                        "type": "string",
                        "enum": ["low", "medium", "high", "critical"],
                    },
                    "likelihood": {
                        "type": "string",
                        "enum": ["unlikely", "possible", "likely", "almost_certain"],
                    },
                    "mitigation": {"type": "string"},
                },
                "required": [
                    "description",
                    "category",
                    "severity",
                    "likelihood",
                    "mitigation",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["risks"],
    "additionalProperties": False,
}


def _enum(enum_cls, value: object, fallback):  # type: ignore[no-untyped-def]
    try:
        return enum_cls(str(value).lower())
    except ValueError:
        return fallback


class RiskAgent(BaseAgent):
    name = "risk"
    description = "Identifies strategic, technical, market, and regulatory risks"

    async def _run(self, input_data: AgentInput) -> dict[str, object]:
        query = input_data["query"]
        context = input_data["context"]
        pool_text: str = str(context.get("evidence_pool", ""))

        user_prompt = (
            f"Strategic question: {query}\n\n"
            f"Retrieved sources:\n{pool_text}\n\n"
            "Identify all relevant risks across strategic, technical, market, "
            "and regulatory dimensions."
        )

        result = await self._ask_json(SYSTEM_PROMPT, user_prompt, "submit_risks", _SCHEMA)
        raw_items = result.get("risks", [])
        items = raw_items if isinstance(raw_items, list) else []

        risks: list[RiskItem] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            risks.append(
                RiskItem(
                    description=str(item.get("description", "")),
                    category=_enum(RiskCategory, item.get("category"), RiskCategory.STRATEGIC),
                    severity=_enum(Severity, item.get("severity"), Severity.MEDIUM),
                    likelihood=_enum(Likelihood, item.get("likelihood"), Likelihood.POSSIBLE),
                    mitigation=str(item.get("mitigation", "")),
                )
            )

        return {"risks": risks}

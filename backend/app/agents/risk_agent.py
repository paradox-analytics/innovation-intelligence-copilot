from __future__ import annotations

import logging

from app.models import AgentInput, Likelihood, RiskCategory, RiskItem, Severity

from .base import BaseAgent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a technology risk analyst. You are given a strategic question and a \
numbered pool of retrieved sources (web and document). Identify strategic, \
technical, market, and regulatory risks grounded in those sources.

Return a JSON array:
[
  {
    "description": "risk description",
    "category": "strategic" | "technical" | "market" | "regulatory",
    "severity": "low" | "medium" | "high" | "critical",
    "likelihood": "unlikely" | "possible" | "likely" | "almost_certain",
    "mitigation": "recommended mitigation strategy"
  }
]

Be specific about each risk. Return valid JSON only, no markdown fences."""


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

        raw = await self._ask_claude(SYSTEM_PROMPT, user_prompt)
        parsed = self._parse_json(raw, [])
        items: list[dict[str, object]] = parsed if isinstance(parsed, list) else []

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

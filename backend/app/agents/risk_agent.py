from __future__ import annotations

import json
import logging

from app.models import AgentInput, Likelihood, RiskCategory, RiskItem, Severity

from .base import BaseAgent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a technology risk analyst. Given a strategic question and research evidence, \
identify strategic, technical, market, and regulatory risks.

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


class RiskAgent(BaseAgent):
    name = "risk"
    description = "Identifies strategic, technical, market, and regulatory risks"

    async def _run(self, input_data: AgentInput) -> dict[str, object]:
        query = input_data["query"]
        context = input_data["context"]
        research_evidence: list[dict[str, object]] = context.get("research_evidence", [])  # type: ignore[assignment]

        evidence_text = "\n".join(
            f"- {e.get('claim', '')} (confidence: {e.get('confidence', 0)})"
            for e in research_evidence
        )

        user_prompt = (
            f"Strategic question: {query}\n\n"
            f"Research evidence:\n{evidence_text}\n\n"
            "Identify all relevant risks across strategic, technical, market, "
            "and regulatory dimensions."
        )

        raw = await self._ask_claude(SYSTEM_PROMPT, user_prompt)
        parsed: list[dict[str, object]] = json.loads(raw)

        risks: list[RiskItem] = []
        for item in parsed:
            risks.append(
                RiskItem(
                    description=str(item.get("description", "")),
                    category=RiskCategory(item.get("category", "strategic")),
                    severity=Severity(item.get("severity", "medium")),
                    likelihood=Likelihood(item.get("likelihood", "possible")),
                    mitigation=str(item.get("mitigation", "")),
                )
            )

        return {"risks": risks}

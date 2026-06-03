from __future__ import annotations

import json
import logging

from app.models import AgentInput, Evidence, SourceCitation

from .base import BaseAgent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a technology investment analyst building the SUPPORTING case for a \
technology adoption or investment decision.

Given a strategic question and research evidence, identify the strongest \
supporting factors for moving forward.

Return a JSON array:
[
  {
    "claim": "supporting factor",
    "confidence": 0.0-1.0,
    "reasoning": "why this supports adoption/investment"
  }
]

Be specific and grounded in the evidence. Return valid JSON only, no markdown fences."""


class SupportAgent(BaseAgent):
    name = "support"
    description = "Builds the investment/adoption case using evidence"

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
            "Identify the strongest supporting factors."
        )

        raw = await self._ask_claude(SYSTEM_PROMPT, user_prompt)
        parsed: list[dict[str, object]] = json.loads(raw)

        evidence_list: list[Evidence] = []
        for item in parsed:
            evidence_list.append(
                Evidence(
                    claim=str(item.get("claim", "")),
                    supporting_sources=[
                        SourceCitation(
                            document_id="derived",
                            title="Support analysis",
                            chunk_text=str(item.get("reasoning", "")),
                            relevance_score=float(item.get("confidence", 0.0)),
                        )
                    ],
                    confidence=float(item.get("confidence", 0.0)),
                )
            )

        return {"supporting_evidence": evidence_list}

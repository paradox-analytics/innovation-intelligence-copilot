from __future__ import annotations

import json
import logging

from app.models import AgentInput, Evidence, SourceCitation

from .base import BaseAgent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a critical technology analyst who challenges assumptions and plays \
devil's advocate. Your job is to find weaknesses, contradictions, and risks \
in a proposed technology strategy.

Given a strategic question and research evidence, identify:
1. Weak or questionable assumptions
2. Contradictory evidence
3. Historical precedents where similar technologies failed

Return a JSON object:
{
  "contrarian_evidence": [
    {
      "claim": "why this might fail or be wrong",
      "confidence": 0.0-1.0,
      "challenged_assumption": "the assumption being challenged"
    }
  ],
  "challenged_assumptions": ["assumption 1", "assumption 2"]
}

Be rigorous but fair. Return valid JSON only, no markdown fences."""


class SkepticAgent(BaseAgent):
    name = "skeptic"
    description = "Challenges assumptions and finds contradictory evidence"

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
            f"Research evidence (to challenge):\n{evidence_text}\n\n"
            "Find weaknesses, contradictions, and reasons this could fail."
        )

        raw = await self._ask_claude(SYSTEM_PROMPT, user_prompt)
        parsed: dict[str, object] = json.loads(raw)

        contrarian_items: list[dict[str, object]] = parsed.get("contrarian_evidence", [])  # type: ignore[assignment]
        challenged: list[str] = parsed.get("challenged_assumptions", [])  # type: ignore[assignment]

        contrarian_evidence: list[Evidence] = []
        for item in contrarian_items:
            contrarian_evidence.append(
                Evidence(
                    claim=str(item.get("claim", "")),
                    supporting_sources=[
                        SourceCitation(
                            document_id="derived",
                            title="Skeptic analysis",
                            chunk_text=str(item.get("challenged_assumption", "")),
                            relevance_score=float(item.get("confidence", 0.0)),
                        )
                    ],
                    confidence=float(item.get("confidence", 0.0)),
                )
            )

        return {
            "contrarian_evidence": contrarian_evidence,
            "challenged_assumptions": challenged,
        }

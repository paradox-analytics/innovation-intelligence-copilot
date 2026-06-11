from __future__ import annotations

import logging

from app.agents.retrieval import EvidenceSource, citations_for_indices
from app.models import AgentInput, Evidence

from .base import BaseAgent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a critical technology analyst who challenges assumptions and plays \
devil's advocate. You are given a numbered pool of retrieved sources (web and \
document).

Find weaknesses, contradictions, and reasons a proposed strategy could fail, \
grounding each point ONLY in the sources provided and citing their index numbers.

Return a JSON object:
{
  "contrarian_evidence": [
    {
      "claim": "why this might fail or be wrong",
      "confidence": 0.0-1.0,
      "source_indices": [1, 4]
    }
  ],
  "challenged_assumptions": ["assumption 1", "assumption 2"]
}

You MUST produce at least 3 items in "contrarian_evidence", each citing at least \
one source index. Do not invent sources. Return valid JSON only, no markdown fences."""


class SkepticAgent(BaseAgent):
    name = "skeptic"
    description = "Challenges assumptions using retrieved sources"

    async def _run(self, input_data: AgentInput) -> dict[str, object]:
        query = input_data["query"]
        context = input_data["context"]
        pool: list[EvidenceSource] = context.get("pool", [])  # type: ignore[assignment]
        pool_text: str = str(context.get("evidence_pool", ""))

        user_prompt = (
            f"Strategic question: {query}\n\n"
            f"Retrieved sources (to challenge):\n{pool_text}\n\n"
            "Find weaknesses, contradictions, and reasons this could fail. "
            "Cite source indices."
        )

        raw = await self._ask_claude(SYSTEM_PROMPT, user_prompt)
        parsed = self._parse_json(raw, {})
        obj: dict[str, object] = parsed if isinstance(parsed, dict) else {}

        contrarian_items = obj.get("contrarian_evidence", [])
        items: list[dict[str, object]] = (
            contrarian_items if isinstance(contrarian_items, list) else []
        )

        contrarian_evidence: list[Evidence] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            indices = [i for i in item.get("source_indices", []) if isinstance(i, int)]
            contrarian_evidence.append(
                Evidence(
                    claim=str(item.get("claim", "")),
                    supporting_sources=citations_for_indices(pool, indices),
                    confidence=float(item.get("confidence", 0.0) or 0.0),
                )
            )

        challenged_raw = obj.get("challenged_assumptions", [])
        challenged: list[str] = (
            [str(a) for a in challenged_raw] if isinstance(challenged_raw, list) else []
        )

        return {
            "contrarian_evidence": contrarian_evidence,
            "challenged_assumptions": challenged,
        }

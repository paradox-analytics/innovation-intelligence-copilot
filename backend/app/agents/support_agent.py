from __future__ import annotations

import logging

from app.agents.retrieval import EvidenceSource, citations_for_indices
from app.models import AgentInput, Evidence

from .base import BaseAgent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a technology investment analyst building the SUPPORTING case for a \
technology adoption or investment decision.

You are given a numbered pool of retrieved sources (web and document). Identify \
the strongest supporting factors, grounding each claim ONLY in the sources \
provided. Cite the source index numbers your claim draws on.

Return a JSON array:
[
  {
    "claim": "supporting factor, stated as a concrete claim",
    "confidence": 0.0-1.0,
    "source_indices": [0, 3]
  }
]

Every claim MUST cite at least one source index from the pool. Do not invent \
sources or facts not present in the pool. Return valid JSON only, no markdown fences."""


class SupportAgent(BaseAgent):
    name = "support"
    description = "Builds the investment/adoption case grounded in retrieved sources"

    async def _run(self, input_data: AgentInput) -> dict[str, object]:
        query = input_data["query"]
        context = input_data["context"]
        pool: list[EvidenceSource] = context.get("pool", [])  # type: ignore[assignment]
        pool_text: str = str(context.get("evidence_pool", ""))

        user_prompt = (
            f"Strategic question: {query}\n\n"
            f"Retrieved sources:\n{pool_text}\n\n"
            "Identify the strongest supporting factors, citing source indices."
        )

        raw = await self._ask_claude(SYSTEM_PROMPT, user_prompt)
        parsed = self._parse_json(raw, [])
        items: list[dict[str, object]] = parsed if isinstance(parsed, list) else []

        evidence_list: list[Evidence] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            indices = [i for i in item.get("source_indices", []) if isinstance(i, int)]
            evidence_list.append(
                Evidence(
                    claim=str(item.get("claim", "")),
                    supporting_sources=citations_for_indices(pool, indices),
                    confidence=float(item.get("confidence", 0.0) or 0.0),
                )
            )

        return {"supporting_evidence": evidence_list}

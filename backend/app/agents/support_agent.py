from __future__ import annotations

import logging
from typing import Any

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

Assign `confidence` by evidence strength, using this exact rubric:
- 0.85-1.00: multiple independent sources in the pool directly support the claim
- 0.50-0.84: one source directly supports it, or it is a strong inference
- 0.20-0.49: only weak, indirect, or speculative support

Produce 3-6 claims, ordered by confidence (highest first). Every claim MUST cite \
at least one source index that exists in the pool. Do not invent sources or facts."""

_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "supporting_evidence": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "claim": {"type": "string"},
                    "confidence": {"type": "number"},
                    "source_indices": {"type": "array", "items": {"type": "integer"}},
                },
                "required": ["claim", "confidence", "source_indices"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["supporting_evidence"],
    "additionalProperties": False,
}


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

        result = await self._ask_json(SYSTEM_PROMPT, user_prompt, "submit_support", _SCHEMA)
        raw_items = result.get("supporting_evidence", [])
        items = raw_items if isinstance(raw_items, list) else []

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

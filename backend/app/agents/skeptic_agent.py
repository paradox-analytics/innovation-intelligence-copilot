from __future__ import annotations

import logging
from typing import Any

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

Assign `confidence` by evidence strength, using this exact rubric:
- 0.85-1.00: multiple independent sources directly support the concern
- 0.50-0.84: one source directly supports it, or it is a strong inference
- 0.20-0.49: only weak, indirect, or speculative support

Produce at least 3 contrarian points, ordered by confidence (highest first). \
Every point MUST cite at least one source index that exists in the pool. Do not \
invent sources."""

_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "contrarian_evidence": {
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
        },
        "challenged_assumptions": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["contrarian_evidence", "challenged_assumptions"],
    "additionalProperties": False,
}


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

        result = await self._ask_json(SYSTEM_PROMPT, user_prompt, "submit_skeptic", _SCHEMA)

        raw_items = result.get("contrarian_evidence", [])
        items = raw_items if isinstance(raw_items, list) else []

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

        raw_challenged = result.get("challenged_assumptions", [])
        challenged: list[str] = (
            [str(a) for a in raw_challenged] if isinstance(raw_challenged, list) else []
        )

        return {
            "contrarian_evidence": contrarian_evidence,
            "challenged_assumptions": challenged,
        }

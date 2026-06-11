from __future__ import annotations

import json
import logging

from app.models import AgentInput, Evidence, SourceCitation

from .base import BaseAgent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a technology research analyst. Given a strategic question and retrieved \
evidence chunks, synthesize the evidence into structured findings.

Return a JSON array of evidence objects:
[
  {
    "claim": "concise factual claim",
    "confidence": 0.0-1.0,
    "source_indices": [0, 2]
  }
]

Use ONLY information present in the provided chunks. Cite sources by their index. \
Return valid JSON only, no markdown fences."""


class ResearchAgent(BaseAgent):
    name = "research"
    description = "Collects and synthesizes evidence from the RAG layer"

    async def _run(self, input_data: AgentInput) -> dict[str, object]:
        query = input_data["query"]
        context = input_data["context"]
        chunks: list[dict[str, object]] = context.get("chunks", [])  # type: ignore[assignment]

        if not chunks:
            return {"evidence": [], "note": "No source documents available"}

        chunks_text = "\n\n".join(
            f"[{i}] (source: {c.get('title', 'unknown')}): {c.get('content', '')}"
            for i, c in enumerate(chunks)
        )

        user_prompt = f"Strategic question: {query}\n\nRetrieved evidence chunks:\n{chunks_text}"

        raw = await self._ask_claude(SYSTEM_PROMPT, user_prompt)
        parsed: list[dict[str, object]] = json.loads(raw)

        evidence_list: list[Evidence] = []
        for item in parsed:
            source_indices: list[int] = item.get("source_indices", [])  # type: ignore[assignment]
            citations = [
                SourceCitation(
                    document_id=str(chunks[idx].get("document_id", "")),
                    title=str(chunks[idx].get("title", "")),
                    chunk_text=str(chunks[idx].get("content", ""))[:300],
                    relevance_score=float(chunks[idx].get("relevance_score", 0.0)),
                )
                for idx in source_indices
                if idx < len(chunks)
            ]
            evidence_list.append(
                Evidence(
                    claim=str(item.get("claim", "")),
                    supporting_sources=citations,
                    confidence=float(item.get("confidence", 0.0)),
                )
            )

        return {"evidence": evidence_list}

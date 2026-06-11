"""Unified retrieval: merge live web sources + ingested documents into one
indexed evidence pool that every downstream agent grounds its claims against.

This is the single retrieval step for the whole pipeline — agents do NOT search
on their own. They receive the pool, reason over it, and cite by index, so real
citations survive all the way to the final result.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SourceCitation
from app.rag.retriever import hybrid_search
from app.rag.web_search import search_web

logger = logging.getLogger(__name__)

_DEFAULT_DOC_K = 10
_DEFAULT_WEB_K = 8
_MAX_POOL = 16


@dataclass
class EvidenceSource:
    index: int
    kind: str  # "web" | "doc"
    title: str
    snippet: str
    relevance: str  # high | medium | low
    relevance_score: float
    url: str | None = None
    document_id: str | None = None


def _bucket_by_rank(rank: int) -> str:
    if rank <= 1:
        return "high"
    if rank <= 4:
        return "medium"
    return "low"


async def retrieve_evidence(
    query: str,
    db: AsyncSession,
    doc_k: int = _DEFAULT_DOC_K,
    web_k: int = _DEFAULT_WEB_K,
) -> list[EvidenceSource]:
    """Retrieve from web + documents in parallel; return one indexed pool."""
    web_task = search_web(query, max_sources=web_k)
    doc_task = hybrid_search(query, db, top_k=doc_k)

    web_result, doc_result = await asyncio.gather(web_task, doc_task, return_exceptions=True)

    if isinstance(web_result, BaseException):
        logger.warning("web retrieval failed: %s", web_result)
        web_result = []
    if isinstance(doc_result, BaseException):
        logger.warning("doc retrieval failed: %s", doc_result)
        doc_result = []

    pool: list[EvidenceSource] = []

    # Web sources first (current signals), then documents (proprietary/grounded).
    for src in web_result:
        pool.append(
            EvidenceSource(
                index=len(pool),
                kind="web",
                title=src.title,
                snippet=src.snippet,
                relevance=src.relevance,
                relevance_score=src.relevance_score,
                url=src.url,
            )
        )

    for rank, chunk in enumerate(doc_result):
        pool.append(
            EvidenceSource(
                index=len(pool),
                kind="doc",
                title=chunk.title,
                snippet=chunk.content[:400],
                relevance=_bucket_by_rank(rank),
                relevance_score=chunk.relevance_score,
                url=chunk.source_url,
                document_id=chunk.document_id,
            )
        )
        if len(pool) >= _MAX_POOL:
            break

    logger.info(
        "retrieve_evidence: %d sources (%d web, %d doc) for query=%r",
        len(pool),
        sum(1 for s in pool if s.kind == "web"),
        sum(1 for s in pool if s.kind == "doc"),
        query[:80],
    )
    return pool


def format_pool_for_prompt(pool: list[EvidenceSource]) -> str:
    """Render the indexed pool for an agent prompt. Agents cite these indices."""
    if not pool:
        return "(no sources retrieved)"
    lines: list[str] = []
    for s in pool:
        locator = s.url or (f"document {s.document_id}" if s.document_id else "")
        header = f"[{s.index}] ({s.kind}, relevance: {s.relevance}) {s.title}"
        if locator:
            header += f" — {locator}"
        lines.append(header)
        if s.snippet:
            lines.append(f"    {s.snippet}")
    return "\n".join(lines)


def citations_for_indices(
    pool: list[EvidenceSource],
    indices: list[int],
) -> list[SourceCitation]:
    """Map a claim's cited source indices back to real SourceCitations."""
    citations: list[SourceCitation] = []
    for idx in indices:
        if not isinstance(idx, int) or idx < 0 or idx >= len(pool):
            continue
        s = pool[idx]
        citations.append(
            SourceCitation(
                document_id=s.document_id or "",
                title=s.title,
                chunk_text=s.snippet[:300],
                relevance_score=s.relevance_score,
                url=s.url,
                kind=s.kind,
            )
        )
    return citations

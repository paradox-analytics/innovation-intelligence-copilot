from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SourceCitation

from .embeddings import embed_text

logger = logging.getLogger(__name__)

_DEFAULT_TOP_K = 10


@dataclass
class RetrievedChunk:
    document_id: str
    chunk_id: str
    content: str
    title: str
    relevance_score: float
    metadata: dict[str, object]


async def semantic_search(
    query: str,
    db: AsyncSession,
    top_k: int | None = None,
) -> list[RetrievedChunk]:
    k = top_k or _DEFAULT_TOP_K
    query_embedding = await embed_text(query)

    # pgvector cosine distance: embedding <=> query; similarity = 1 - distance
    result = await db.execute(
        text("""
            SELECT
                dc.id AS chunk_id,
                dc.document_id,
                dc.content,
                d.title,
                d.metadata,
                1 - (dc.embedding <=> :embedding::vector) AS similarity
            FROM document_chunks dc
            JOIN documents d ON d.id = dc.document_id
            ORDER BY dc.embedding <=> :embedding::vector
            LIMIT :k
        """),
        {"embedding": str(query_embedding), "k": k},
    )
    rows = result.mappings().all()

    return [
        RetrievedChunk(
            document_id=row["document_id"],
            chunk_id=row["chunk_id"],
            content=row["content"],
            title=row["title"],
            relevance_score=float(row["similarity"]),
            metadata=dict(row["metadata"]) if row["metadata"] else {},
        )
        for row in rows
    ]


async def keyword_search(
    query: str,
    db: AsyncSession,
    top_k: int | None = None,
) -> list[RetrievedChunk]:
    k = top_k or _DEFAULT_TOP_K

    result = await db.execute(
        text("""
            SELECT
                dc.id AS chunk_id,
                dc.document_id,
                dc.content,
                d.title,
                d.metadata,
                ts_rank(
                    to_tsvector('english', dc.content),
                    plainto_tsquery('english', :query)
                ) AS rank
            FROM document_chunks dc
            JOIN documents d ON d.id = dc.document_id
            WHERE to_tsvector('english', dc.content) @@ plainto_tsquery('english', :query)
            ORDER BY rank DESC
            LIMIT :k
        """),
        {"query": query, "k": k},
    )
    rows = result.mappings().all()

    return [
        RetrievedChunk(
            document_id=row["document_id"],
            chunk_id=row["chunk_id"],
            content=row["content"],
            title=row["title"],
            relevance_score=float(row["rank"]),
            metadata=dict(row["metadata"]) if row["metadata"] else {},
        )
        for row in rows
    ]


def _reciprocal_rank_fusion(
    result_lists: list[list[RetrievedChunk]],
    k_constant: int = 60,
) -> list[RetrievedChunk]:
    """Reciprocal Rank Fusion merges multiple ranked lists into one.

    RRF score = sum(1 / (k + rank)) across all lists where the item appears.
    k_constant prevents top-ranked items from dominating too heavily.
    """
    scores: dict[str, float] = {}
    chunk_map: dict[str, RetrievedChunk] = {}

    for result_list in result_lists:
        for rank, chunk in enumerate(result_list):
            key = chunk.chunk_id
            scores[key] = scores.get(key, 0.0) + 1.0 / (k_constant + rank)
            chunk_map[key] = chunk

    sorted_keys = sorted(scores, key=lambda cid: scores[cid], reverse=True)

    fused: list[RetrievedChunk] = []
    for key in sorted_keys:
        chunk = chunk_map[key]
        chunk.relevance_score = scores[key]
        fused.append(chunk)

    return fused


async def hybrid_search(
    query: str,
    db: AsyncSession,
    top_k: int | None = None,
) -> list[RetrievedChunk]:
    k = top_k or _DEFAULT_TOP_K

    semantic_results, keyword_results = await asyncio.gather(
        semantic_search(query, db, top_k=k * 2),
        keyword_search(query, db, top_k=k * 2),
    )

    fused = _reciprocal_rank_fusion([semantic_results, keyword_results])
    return fused[:k]


def chunks_to_citations(chunks: list[RetrievedChunk]) -> list[SourceCitation]:
    return [
        SourceCitation(
            document_id=c.document_id,
            title=c.title,
            chunk_text=c.content[:300],
            relevance_score=c.relevance_score,
        )
        for c in chunks
    ]

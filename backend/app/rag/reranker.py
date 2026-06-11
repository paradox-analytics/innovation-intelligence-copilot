"""Result reranking using Claude cross-encoder style scoring and RRF."""

from __future__ import annotations

import asyncio
import json
import logging

import anthropic

from app.core.config import settings
from app.rag.retriever import RetrievedChunk

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = "claude-sonnet-4-6"
_DEFAULT_THRESHOLD = 3
_BATCH_SIZE = 10

_RELEVANCE_SYSTEM_PROMPT = """\
You are a relevance scoring system. Given a query and a document chunk, rate \
how relevant the chunk is to answering the query on a scale of 0-10.

- 0: completely irrelevant
- 1-3: marginally relevant, touches on related topics
- 4-6: moderately relevant, contains some useful information
- 7-9: highly relevant, directly addresses the query
- 10: perfectly relevant, a direct and complete answer

Return ONLY a JSON object: {"score": <integer 0-10>, "reason": "<brief explanation>"}
No markdown fences.\
"""


async def _score_chunk(
    client: anthropic.AsyncAnthropic,
    query: str,
    chunk: RetrievedChunk,
    model: str,
) -> tuple[RetrievedChunk, int, str]:
    """Ask Claude to score a single chunk's relevance to the query."""
    user_prompt = (
        f"Query: {query}\n\nDocument chunk (from '{chunk.title}'):\n{chunk.content[:2000]}"
    )

    try:
        response = await client.messages.create(
            model=model,
            max_tokens=256,
            system=_RELEVANCE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        raw = response.content[0].text
        parsed: dict[str, object] = json.loads(raw)
        score = int(parsed.get("score", 0))
        reason = str(parsed.get("reason", ""))
        return chunk, score, reason
    except Exception as exc:
        logger.warning("Reranking failed for chunk %s: %s", chunk.chunk_id, exc)
        # On failure, assign a neutral score so the chunk is not lost
        return chunk, 5, f"scoring error: {exc}"


async def cross_encoder_rerank(
    query: str,
    chunks: list[RetrievedChunk],
    threshold: int = _DEFAULT_THRESHOLD,
    model: str = _DEFAULT_MODEL,
) -> list[RetrievedChunk]:
    """Rerank chunks using Claude as a cross-encoder relevance judge.

    Each chunk is individually scored for relevance to the query.  Chunks
    scoring below *threshold* are discarded.  The remaining chunks are
    returned sorted by descending relevance score.
    """
    if not chunks:
        return []

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    scored: list[tuple[RetrievedChunk, int, str]] = []

    # Process in batches to avoid overwhelming the API
    for i in range(0, len(chunks), _BATCH_SIZE):
        batch = chunks[i : i + _BATCH_SIZE]
        batch_results = await asyncio.gather(
            *[_score_chunk(client, query, chunk, model) for chunk in batch]
        )
        scored.extend(batch_results)

    # Filter below threshold and sort descending
    filtered = [(chunk, score, reason) for chunk, score, reason in scored if score >= threshold]
    filtered.sort(key=lambda x: x[1], reverse=True)

    reranked: list[RetrievedChunk] = []
    for chunk, score, _reason in filtered:
        # Update relevance_score to reflect the cross-encoder score (normalized)
        chunk.relevance_score = score / 10.0
        reranked.append(chunk)

    logger.info(
        "Reranked %d chunks -> %d above threshold %d",
        len(chunks),
        len(reranked),
        threshold,
    )

    return reranked


def reciprocal_rank_fusion(
    result_lists: list[list[RetrievedChunk]],
    k_constant: int = 60,
) -> list[RetrievedChunk]:
    """Merge multiple ranked result lists using Reciprocal Rank Fusion.

    RRF score for each item = sum(1 / (k + rank)) across all lists where it
    appears.  Higher k_constant prevents top items from dominating.

    This is extracted here for use with expanded queries; the retriever module
    has its own copy for internal use.
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

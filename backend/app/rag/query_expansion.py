"""Query expansion strategies: alternative phrasings and HyDE."""

from __future__ import annotations

import json
import logging

import anthropic
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.rag.reranker import reciprocal_rank_fusion
from app.rag.retriever import RetrievedChunk, hybrid_search, semantic_search

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = "claude-sonnet-4-6"


# ---------------------------------------------------------------------------
# Alternative phrasings
# ---------------------------------------------------------------------------

_REPHRASE_SYSTEM_PROMPT = """\
You are a query expansion system. Given a user's question, generate exactly 3 \
alternative phrasings that capture the same information need but use different \
vocabulary, structure, or perspective.

Rules:
- Each alternative must be meaningfully different (not just synonym swaps)
- Maintain the original intent
- Vary specificity (one broader, one more specific, one from a different angle)

Return a JSON array of exactly 3 strings:
["alternative 1", "alternative 2", "alternative 3"]

No markdown fences.\
"""


async def generate_alternative_queries(
    query: str,
    model: str = _DEFAULT_MODEL,
) -> list[str]:
    """Use Claude to generate 3 alternative phrasings of the user's question."""
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    response = await client.messages.create(
        model=model,
        max_tokens=512,
        system=_REPHRASE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"Original question: {query}"}],
    )

    raw = response.content[0].text
    alternatives: list[str] = json.loads(raw)

    if not isinstance(alternatives, list):
        logger.warning("Query expansion returned non-list: %s", type(alternatives))
        return []

    return [str(a) for a in alternatives[:3]]


# ---------------------------------------------------------------------------
# HyDE — Hypothetical Document Embeddings
# ---------------------------------------------------------------------------

_HYDE_SYSTEM_PROMPT = """\
You are a technical writing assistant. Given a question, write a short \
paragraph (100-200 words) that would be a perfect answer to the question \
as if it appeared in a high-quality technical document.

Do NOT say "the answer is" or "according to research". Write as if this \
text is from an authoritative source document directly addressing the topic.

Return only the paragraph text, no JSON wrapping, no markdown.\
"""


async def generate_hypothetical_document(
    query: str,
    model: str = _DEFAULT_MODEL,
) -> str:
    """Generate a hypothetical answer document for HyDE embedding."""
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    response = await client.messages.create(
        model=model,
        max_tokens=512,
        system=_HYDE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": query}],
    )

    return response.content[0].text


async def hyde_search(
    query: str,
    db: AsyncSession,
    top_k: int = 10,
    model: str = _DEFAULT_MODEL,
) -> list[RetrievedChunk]:
    """HyDE: generate a hypothetical answer, embed it, then search for
    similar real documents."""
    hypothetical = await generate_hypothetical_document(query, model=model)
    logger.info("HyDE generated hypothetical doc (%d chars)", len(hypothetical))

    # Use the hypothetical document as the search query for semantic search.
    # We embed the hypothetical text via semantic_search which calls embed_text
    # internally.
    results = await semantic_search(hypothetical, db, top_k=top_k)
    return results


# ---------------------------------------------------------------------------
# Combined expanded retrieval
# ---------------------------------------------------------------------------


async def expanded_retrieval(
    query: str,
    db: AsyncSession,
    top_k: int = 10,
    use_hyde: bool = True,
    model: str = _DEFAULT_MODEL,
) -> list[RetrievedChunk]:
    """Run the original query plus expanded queries, fuse results via RRF.

    Steps:
    1. Run hybrid search with original query
    2. Generate 3 alternative phrasings, run hybrid search for each
    3. Optionally run HyDE search
    4. Fuse all result lists via Reciprocal Rank Fusion
    5. Return top_k results
    """
    import asyncio

    # Step 1: original query
    original_task = hybrid_search(query, db, top_k=top_k * 2)

    # Step 2: generate alternatives
    alternatives = await generate_alternative_queries(query, model=model)
    alt_tasks = [hybrid_search(alt_query, db, top_k=top_k * 2) for alt_query in alternatives]

    # Step 3: optional HyDE
    hyde_task = hyde_search(query, db, top_k=top_k * 2, model=model) if use_hyde else None

    # Gather all searches
    all_tasks = [original_task, *alt_tasks]
    if hyde_task is not None:
        all_tasks.append(hyde_task)

    all_results: list[list[RetrievedChunk]] = await asyncio.gather(*all_tasks)

    # Step 4: RRF fusion
    fused = reciprocal_rank_fusion(all_results)

    # Step 5: trim
    return fused[:top_k]

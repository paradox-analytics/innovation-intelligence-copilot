from __future__ import annotations

import logging

import openai

from app.core.config import settings

logger = logging.getLogger(__name__)

_DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small"
_DEFAULT_DIMENSIONS = 1536

_client: openai.AsyncOpenAI | None = None


def _get_client() -> openai.AsyncOpenAI:
    global _client
    if _client is None:
        _client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


async def embed_text(text: str) -> list[float]:
    client = _get_client()
    response = await client.embeddings.create(
        model=_DEFAULT_EMBEDDING_MODEL,
        input=text,
        dimensions=_DEFAULT_DIMENSIONS,
    )
    return response.data[0].embedding


async def embed_batch(texts: list[str], batch_size: int = 100) -> list[list[float]]:
    """Embed multiple texts, batching to stay within API limits."""
    client = _get_client()
    all_embeddings: list[list[float]] = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        response = await client.embeddings.create(
            model=_DEFAULT_EMBEDDING_MODEL,
            input=batch,
            dimensions=_DEFAULT_DIMENSIONS,
        )
        all_embeddings.extend([item.embedding for item in response.data])

    return all_embeddings

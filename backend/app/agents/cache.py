"""Deterministic re-runs via caching.

For an identical query under the same models/prompts/settings we can:
  - reuse the retrieved evidence pool (stops live web results from drifting), and
  - optionally return the prior result verbatim (zero drift, zero cost).

State is kept inside the existing analysis_requests.result JSONB under private
``_``-prefixed keys, so no schema migration is required. A config signature
(models + settings + ANALYSIS_PROMPT_VERSION) invalidates the cache when the
pipeline changes materially.
"""

from __future__ import annotations

import hashlib
from typing import Any

from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.retrieval import EvidenceSource
from app.core.config import settings


def normalize_query(query: str) -> str:
    return " ".join(query.split()).lower()


def query_hash(query: str) -> str:
    return hashlib.md5(normalize_query(query).encode()).hexdigest()  # noqa: S324 — cache key


def config_signature() -> str:
    """Changes when any pipeline knob that affects output changes."""
    key = "|".join(
        str(x)
        for x in (
            settings.ANALYSIS_PROMPT_VERSION,
            settings.AGENT_MODEL,
            settings.EXECUTIVE_MODEL,
            settings.WEB_SEARCH_MODEL,
            settings.ENABLE_WEB_SEARCH,
            settings.WEB_SEARCH_MAX_USES,
            settings.ANALYSIS_TEMPERATURE,
        )
    )
    return hashlib.md5(key.encode()).hexdigest()[:12]  # noqa: S324 — cache key


def pool_to_json(pool: list[EvidenceSource]) -> list[dict[str, Any]]:
    return [
        {
            "index": s.index,
            "kind": s.kind,
            "title": s.title,
            "snippet": s.snippet,
            "relevance": s.relevance,
            "relevance_score": s.relevance_score,
            "url": s.url,
            "document_id": s.document_id,
        }
        for s in pool
    ]


def pool_from_json(data: Any) -> list[EvidenceSource]:
    pool: list[EvidenceSource] = []
    if not isinstance(data, list):
        return pool
    for d in data:
        if not isinstance(d, dict):
            continue
        pool.append(
            EvidenceSource(
                index=int(d.get("index", len(pool))),
                kind=str(d.get("kind", "doc")),
                title=str(d.get("title", "")),
                snippet=str(d.get("snippet", "")),
                relevance=str(d.get("relevance", "low")),
                relevance_score=float(d.get("relevance_score", 0.0) or 0.0),
                url=d.get("url"),
                document_id=d.get("document_id"),
            )
        )
    return pool


async def find_cached(
    db: AsyncSession, query: str, config_sig: str, exclude_id: str
) -> dict[str, Any] | None:
    """Most recent completed result for the same query + config, if any.

    Matches on the private keys we only write on completion, so no status filter
    is needed.
    """
    row = (
        await db.execute(
            sql_text(
                "SELECT result FROM analysis_requests "
                "WHERE id != :cur "
                "AND result->>'_query_hash' = :qh "
                "AND result->>'_config_sig' = :cs "
                "ORDER BY created_at DESC LIMIT 1"
            ),
            {"cur": exclude_id, "qh": query_hash(query), "cs": config_sig},
        )
    ).first()
    if row is None:
        return None
    result = row[0]
    return result if isinstance(result, dict) else None

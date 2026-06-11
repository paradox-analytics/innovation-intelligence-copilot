"""Persist extracted entities/relationships to Postgres + Neo4j, and feed
completed analyses into the knowledge graph (tagged provenance="analysis").

Entity ids are deterministic (see entity_extractor._stable_entity_id) and
relationship ids are derived from (source, target, type), so re-ingesting the
same content dedupes via ON CONFLICT / MERGE instead of creating duplicate nodes.
"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

from sqlalchemy import text as sql_text

from app.core.database import async_session_factory
from app.core.neo4j_client import neo4j_client
from app.graph.entity_extractor import extract_entities
from app.graph.service import KnowledgeGraphService
from app.models import GraphEntity, GraphRelationship

logger = logging.getLogger(__name__)

# Extractor entity types -> DB entity_type_enum.
_TYPE_MAP: dict[str, str] = {
    "technology": "TECHNOLOGY",
    "company": "COMPANY",
    "startup": "STARTUP",
    "market": "MARKET",
    "patent": "PATENT",
    "research_topic": "RESEARCH_TOPIC",
    "research_org": "COMPANY",
    "person": "COMPANY",
    "standard": "TECHNOLOGY",
    "regulation": "TECHNOLOGY",
    "product": "TECHNOLOGY",
}


def _rel_id(rel: GraphRelationship) -> str:
    key = f"{rel.source_id}:{rel.target_id}:{rel.relationship_type}"
    return hashlib.md5(key.encode()).hexdigest()  # noqa: S324 — non-crypto, stable key


async def persist_graph(
    entities: list[GraphEntity],
    relationships: list[GraphRelationship],
) -> None:
    """Upsert entities + relationships to Postgres (dedup by stable id), then Neo4j (best-effort)."""
    if not entities and not relationships:
        return

    async with async_session_factory() as db:
        for e in entities:
            etype = _TYPE_MAP.get(e.entity_type.lower(), "TECHNOLOGY")
            await db.execute(
                sql_text(
                    "INSERT INTO entities (id, name, entity_type, properties) "
                    "VALUES (:id, :name, cast(:etype as entity_type_enum), cast(:props as jsonb)) "
                    "ON CONFLICT (id) DO NOTHING"
                ),
                {
                    "id": e.id,
                    "name": e.name,
                    "etype": etype,
                    "props": json.dumps(e.properties),
                },
            )
        for r in relationships:
            await db.execute(
                sql_text(
                    "INSERT INTO relationships "
                    "(id, source_entity_id, target_entity_id, relationship_type, properties) "
                    "VALUES (:id, :src, :tgt, :rtype, cast(:props as jsonb)) "
                    "ON CONFLICT (id) DO NOTHING"
                ),
                {
                    "id": _rel_id(r),
                    "src": r.source_id,
                    "tgt": r.target_id,
                    "rtype": r.relationship_type,
                    "props": json.dumps(r.properties),
                },
            )
        await db.commit()

    try:
        svc = KnowledgeGraphService(neo4j_client)
        for e in entities:
            await svc.upsert_entity(e)
        for r in relationships:
            await svc.upsert_relationship(r)
    except Exception:
        logger.warning("Neo4j graph persist failed (non-fatal); entities stored in Postgres")


def _analysis_text(result: dict[str, Any]) -> str:
    """Build a compact text from an analysis result for entity extraction."""
    parts: list[str] = []
    if result.get("query"):
        parts.append(f"Question: {result['query']}")
    if result.get("recommendation"):
        parts.append(f"Recommendation: {result['recommendation']}")
    if result.get("executive_summary"):
        parts.append(str(result["executive_summary"]))
    for key in ("supporting_evidence", "contrarian_evidence"):
        for ev in result.get(key, []) or []:
            if isinstance(ev, dict) and ev.get("claim"):
                parts.append(f"- {ev['claim']}")
    for sig in result.get("technology_signals", []) or []:
        if isinstance(sig, dict) and sig.get("name"):
            parts.append(f"Signal: {sig['name']} ({sig.get('category', '')})")
    return "\n".join(parts)[:4000]


async def ingest_analysis_to_graph(result: dict[str, Any], analysis_id: str) -> None:
    """Extract entities/relationships from a completed analysis and add them to the KG."""
    text = _analysis_text(result)
    if not text.strip():
        return
    entities, relationships = await extract_entities(text, provenance="analysis")
    for e in entities:
        e.properties.setdefault("source_analysis_id", analysis_id)
    await persist_graph(entities, relationships)
    logger.info(
        "analysis_kg analysis_id=%s entities=%d relationships=%d",
        analysis_id,
        len(entities),
        len(relationships),
    )

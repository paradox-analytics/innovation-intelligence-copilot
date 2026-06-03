from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.neo4j_client import Neo4jClient, get_graph_db
from app.models.knowledge import Entity, EntityType, Relationship

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class EntityResponse(BaseModel):
    id: str
    name: str
    entity_type: str
    properties: dict[str, object] | None = None
    neo4j_id: str | None = None


class RelationshipResponse(BaseModel):
    id: str
    source_entity_id: str
    target_entity_id: str
    relationship_type: str
    properties: dict[str, object] | None = None


class EntityWithRelationshipsResponse(BaseModel):
    entity: EntityResponse
    relationships: list[RelationshipResponse]


class SubgraphResponse(BaseModel):
    entities: list[EntityResponse]
    relationships: list[RelationshipResponse]


class TechnologySignalRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=512, description="Technology topic to detect signals for")
    depth: int = Field(default=2, ge=1, le=5, description="Graph traversal depth")


class TechnologySignal(BaseModel):
    technology: str
    signal_type: str
    signal_strength: float
    related_entities: list[str]


class EntityListResponse(BaseModel):
    data: list[EntityResponse]
    total: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/entities",
    response_model=EntityListResponse,
    summary="Search entities",
)
async def search_entities(
    q: str | None = Query(default=None, min_length=1, max_length=256, description="Search query"),
    entity_type: EntityType | None = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> EntityListResponse:
    query = select(Entity)
    count_query = select(__import__("sqlalchemy").func.count(Entity.id))

    if q is not None:
        query = query.where(Entity.name.ilike(f"%{q}%"))
        count_query = count_query.where(Entity.name.ilike(f"%{q}%"))

    if entity_type is not None:
        query = query.where(Entity.entity_type == entity_type)
        count_query = count_query.where(Entity.entity_type == entity_type)

    query = query.order_by(Entity.name).offset(offset).limit(limit)

    result = await db.execute(query)
    entities = result.scalars().all()

    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    return EntityListResponse(
        data=[
            EntityResponse(
                id=e.id,
                name=e.name,
                entity_type=e.entity_type.value,
                properties=e.properties,
                neo4j_id=e.neo4j_id,
            )
            for e in entities
        ],
        total=total,
    )


@router.get(
    "/entities/{entity_id}/relationships",
    response_model=dict[str, EntityWithRelationshipsResponse],
    summary="Get entity with its relationships",
)
async def get_entity_relationships(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, EntityWithRelationshipsResponse]:
    result = await db.execute(
        select(Entity)
        .options(
            selectinload(Entity.outgoing_relationships),
            selectinload(Entity.incoming_relationships),
        )
        .where(Entity.id == entity_id)
    )
    entity = result.scalar_one_or_none()
    if entity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entity {entity_id} not found",
        )

    all_relationships = list(entity.outgoing_relationships) + list(entity.incoming_relationships)

    return {
        "data": EntityWithRelationshipsResponse(
            entity=EntityResponse(
                id=entity.id,
                name=entity.name,
                entity_type=entity.entity_type.value,
                properties=entity.properties,
                neo4j_id=entity.neo4j_id,
            ),
            relationships=[
                RelationshipResponse(
                    id=r.id,
                    source_entity_id=r.source_entity_id,
                    target_entity_id=r.target_entity_id,
                    relationship_type=r.relationship_type,
                    properties=r.properties,
                )
                for r in all_relationships
            ],
        )
    }


@router.get(
    "/graph",
    response_model=dict[str, SubgraphResponse],
    summary="Get subgraph for a topic",
)
async def get_subgraph(
    topic: str = Query(..., min_length=1, max_length=256),
    depth: int = Query(default=2, ge=1, le=5),
    graph_db: Neo4jClient = Depends(get_graph_db),
) -> dict[str, SubgraphResponse]:
    query = """
    MATCH (start)
    WHERE toLower(start.name) CONTAINS toLower($topic)
    CALL apoc.path.subgraphAll(start, {maxLevel: $depth})
    YIELD nodes, relationships
    RETURN nodes, relationships
    """
    try:
        records = await graph_db.execute_read(query, {"topic": topic, "depth": depth})
    except Exception:
        # Fallback: simpler query without APOC
        fallback_query = """
        MATCH (n)-[r]-(m)
        WHERE toLower(n.name) CONTAINS toLower($topic)
        RETURN
            collect(DISTINCT {id: elementId(n), name: n.name, type: labels(n)[0], properties: properties(n)})
            + collect(DISTINCT {id: elementId(m), name: m.name, type: labels(m)[0], properties: properties(m)})
            AS entities,
            collect(DISTINCT {
                source: elementId(startNode(r)),
                target: elementId(endNode(r)),
                type: type(r),
                properties: properties(r)
            }) AS relationships
        """
        records = await graph_db.execute_read(fallback_query, {"topic": topic})

    entities: list[EntityResponse] = []
    relationships: list[RelationshipResponse] = []

    for record in records:
        for node in record.get("entities", []):
            entities.append(
                EntityResponse(
                    id=str(node.get("id", "")),
                    name=str(node.get("name", "")),
                    entity_type=str(node.get("type", "TECHNOLOGY")),
                    properties=node.get("properties"),
                    neo4j_id=str(node.get("id", "")),
                )
            )
        for rel in record.get("relationships", []):
            relationships.append(
                RelationshipResponse(
                    id=f"{rel.get('source', '')}-{rel.get('target', '')}",
                    source_entity_id=str(rel.get("source", "")),
                    target_entity_id=str(rel.get("target", "")),
                    relationship_type=str(rel.get("type", "")),
                    properties=rel.get("properties"),
                )
            )

    return {
        "data": SubgraphResponse(entities=entities, relationships=relationships)
    }


@router.post(
    "/signals",
    response_model=dict[str, list[TechnologySignal]],
    summary="Detect technology signals from knowledge graph",
)
async def detect_signals(
    body: TechnologySignalRequest,
    graph_db: Neo4jClient = Depends(get_graph_db),
) -> dict[str, list[TechnologySignal]]:
    query = """
    MATCH (t)-[r]-(related)
    WHERE toLower(t.name) CONTAINS toLower($topic)
    WITH t, type(r) AS rel_type, collect(related.name) AS related_names, count(r) AS rel_count
    RETURN t.name AS technology,
           rel_type AS signal_type,
           rel_count AS signal_strength,
           related_names
    ORDER BY rel_count DESC
    LIMIT 20
    """
    records = await graph_db.execute_read(query, {"topic": body.topic})

    signals: list[TechnologySignal] = []
    for record in records:
        raw_strength = float(record.get("signal_strength", 0))
        # Normalize to 0-1 range
        max_strength = max(
            (float(r.get("signal_strength", 0)) for r in records), default=1.0
        )
        normalized = raw_strength / max_strength if max_strength > 0 else 0.0

        signals.append(
            TechnologySignal(
                technology=str(record.get("technology", "")),
                signal_type=str(record.get("signal_type", "")),
                signal_strength=round(normalized, 3),
                related_entities=record.get("related_names", []),
            )
        )

    return {"data": signals}

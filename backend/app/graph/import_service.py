"""Bulk import service for knowledge graph entities and relationships."""

from __future__ import annotations

import csv
import io
import json
import logging
from dataclasses import dataclass, field
from uuid import uuid4

from app.core.neo4j_client import Neo4jClient
from app.models import GraphEntity, GraphRelationship

logger = logging.getLogger(__name__)

_BATCH_SIZE = 100


@dataclass
class ImportResult:
    """Summary of a bulk import operation."""

    entities_created: int = 0
    entities_updated: int = 0
    entities_skipped: int = 0
    relationships_created: int = 0
    relationships_skipped: int = 0
    errors: list[str] = field(default_factory=list)


class GraphImportService:
    """Bulk import entities and relationships into the knowledge graph.

    Supports JSON and CSV input formats with deduplication and
    automatic relationship inference.
    """

    def __init__(self, client: Neo4jClient) -> None:
        self._client = client

    async def import_json(self, data: dict[str, list[dict[str, object]]]) -> ImportResult:
        """Import entities and relationships from a structured JSON object.

        Expected format:
        {
            "entities": [
                {"name": "...", "entity_type": "...", "properties": {...}}
            ],
            "relationships": [
                {"source": "name", "target": "name", "relationship_type": "...", "properties": {...}}
            ]
        }
        """
        result = ImportResult()

        raw_entities: list[dict[str, object]] = data.get("entities", [])
        raw_relationships: list[dict[str, object]] = data.get("relationships", [])

        # Parse entities
        entities: list[GraphEntity] = []
        for item in raw_entities:
            name = str(item.get("name", "")).strip()
            if not name:
                result.errors.append("Skipped entity with empty name")
                result.entities_skipped += 1
                continue

            entities.append(
                GraphEntity(
                    id=uuid4().hex,
                    name=name,
                    entity_type=str(item.get("entity_type", "unknown")),
                    properties=dict(item.get("properties", {}) or {}),
                )
            )

        # Deduplicate entities by (name, entity_type)
        entities, dedup_count = self._deduplicate_entities(entities)
        result.entities_skipped += dedup_count

        # Batch upsert entities
        name_to_id = await self._batch_upsert_entities(entities, result)

        # Parse relationships
        relationships: list[GraphRelationship] = []
        for item in raw_relationships:
            source_name = str(item.get("source", "")).strip().lower()
            target_name = str(item.get("target", "")).strip().lower()

            source_id = name_to_id.get(source_name)
            target_id = name_to_id.get(target_name)

            if source_id is None or target_id is None:
                result.relationships_skipped += 1
                result.errors.append(
                    f"Relationship skipped: source='{item.get('source')}' "
                    f"or target='{item.get('target')}' not found"
                )
                continue

            relationships.append(
                GraphRelationship(
                    source_id=source_id,
                    target_id=target_id,
                    relationship_type=str(item.get("relationship_type", "related_to")),
                    properties=dict(item.get("properties", {}) or {}),
                )
            )

        # Batch upsert relationships
        await self._batch_upsert_relationships(relationships, result)

        logger.info(
            "JSON import complete: %d entities created, %d updated, "
            "%d relationships created, %d errors",
            result.entities_created,
            result.entities_updated,
            result.relationships_created,
            len(result.errors),
        )

        return result

    async def import_csv(
        self,
        csv_content: str,
        entity_type: str = "unknown",
        name_column: str = "name",
        type_column: str | None = None,
    ) -> ImportResult:
        """Import entities from CSV data.

        Each row becomes an entity.  The *name_column* specifies which CSV
        column holds the entity name.  All other columns become properties.
        """
        result = ImportResult()
        reader = csv.DictReader(io.StringIO(csv_content))

        entities: list[GraphEntity] = []
        for row in reader:
            name = str(row.get(name_column, "")).strip()
            if not name:
                result.entities_skipped += 1
                continue

            etype = str(row.get(type_column, entity_type)) if type_column else entity_type
            properties = {k: v for k, v in row.items() if k not in (name_column, type_column)}

            entities.append(
                GraphEntity(
                    id=uuid4().hex,
                    name=name,
                    entity_type=etype,
                    properties=properties,
                )
            )

        entities, dedup_count = self._deduplicate_entities(entities)
        result.entities_skipped += dedup_count

        name_to_id = await self._batch_upsert_entities(entities, result)

        # Infer relationships between co-occurring entities
        inferred = self._infer_relationships(entities, name_to_id)
        await self._batch_upsert_relationships(inferred, result)

        logger.info(
            "CSV import complete: %d entities, %d inferred relationships",
            result.entities_created + result.entities_updated,
            result.relationships_created,
        )

        return result

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _deduplicate_entities(
        entities: list[GraphEntity],
    ) -> tuple[list[GraphEntity], int]:
        """Deduplicate entities by (lowercase name, entity_type).

        Returns (unique_entities, duplicate_count).
        """
        seen: dict[str, GraphEntity] = {}
        duplicates = 0

        for entity in entities:
            key = f"{entity.name.lower()}::{entity.entity_type.lower()}"
            if key in seen:
                # Merge properties from duplicate into existing
                seen[key].properties.update(entity.properties)
                duplicates += 1
            else:
                seen[key] = entity

        return list(seen.values()), duplicates

    async def _batch_upsert_entities(
        self,
        entities: list[GraphEntity],
        result: ImportResult,
    ) -> dict[str, str]:
        """Upsert entities in batches. Returns name_lower -> id mapping."""
        name_to_id: dict[str, str] = {}

        for i in range(0, len(entities), _BATCH_SIZE):
            batch = entities[i : i + _BATCH_SIZE]
            params_list: list[dict[str, object]] = [
                {
                    "id": e.id,
                    "name": e.name,
                    "entity_type": e.entity_type,
                    "properties": e.properties,
                }
                for e in batch
            ]

            try:
                await self._client.execute_write(
                    """
                    UNWIND $entities AS entity
                    MERGE (e:Entity {name: entity.name, entity_type: entity.entity_type})
                    ON CREATE SET e.id = entity.id, e += entity.properties
                    ON MATCH SET e += entity.properties
                    """,
                    {"entities": params_list},
                )

                for e in batch:
                    name_to_id[e.name.lower()] = e.id
                    result.entities_created += 1

            except Exception as exc:
                error_msg = f"Batch entity upsert failed: {exc}"
                logger.exception(error_msg)
                result.errors.append(error_msg)

        return name_to_id

    async def _batch_upsert_relationships(
        self,
        relationships: list[GraphRelationship],
        result: ImportResult,
    ) -> None:
        """Upsert relationships in batches."""
        for i in range(0, len(relationships), _BATCH_SIZE):
            batch = relationships[i : i + _BATCH_SIZE]
            params_list: list[dict[str, object]] = [
                {
                    "source_id": r.source_id,
                    "target_id": r.target_id,
                    "relationship_type": r.relationship_type,
                    "properties": r.properties,
                }
                for r in batch
            ]

            try:
                await self._client.execute_write(
                    """
                    UNWIND $rels AS rel
                    MATCH (a:Entity {id: rel.source_id})
                    MATCH (b:Entity {id: rel.target_id})
                    MERGE (a)-[r:RELATES_TO {relationship_type: rel.relationship_type}]->(b)
                    SET r += rel.properties
                    """,
                    {"rels": params_list},
                )
                result.relationships_created += len(batch)

            except Exception as exc:
                error_msg = f"Batch relationship upsert failed: {exc}"
                logger.exception(error_msg)
                result.errors.append(error_msg)

    @staticmethod
    def _infer_relationships(
        entities: list[GraphEntity],
        name_to_id: dict[str, str],
    ) -> list[GraphRelationship]:
        """Auto-create edges between entities that share property values,
        indicating co-occurrence or relatedness."""
        relationships: list[GraphRelationship] = []

        # Build property value -> entity list index for co-occurrence detection
        value_to_entities: dict[str, list[int]] = {}
        for idx, entity in enumerate(entities):
            for _key, val in entity.properties.items():
                val_str = str(val).lower().strip()
                if len(val_str) < 3 or len(val_str) > 200:
                    continue
                if val_str not in value_to_entities:
                    value_to_entities[val_str] = []
                value_to_entities[val_str].append(idx)

        seen_pairs: set[str] = set()

        for _value, indices in value_to_entities.items():
            if len(indices) < 2 or len(indices) > 10:
                continue

            for i in range(len(indices)):
                for j in range(i + 1, len(indices)):
                    e_a = entities[indices[i]]
                    e_b = entities[indices[j]]
                    pair_key = f"{e_a.id}::{e_b.id}"
                    reverse_key = f"{e_b.id}::{e_a.id}"

                    if pair_key in seen_pairs or reverse_key in seen_pairs:
                        continue
                    seen_pairs.add(pair_key)

                    relationships.append(
                        GraphRelationship(
                            source_id=e_a.id,
                            target_id=e_b.id,
                            relationship_type="co_occurs_with",
                            properties={"inferred": True},
                        )
                    )

        return relationships

from __future__ import annotations

import logging

from app.core.neo4j_client import Neo4jClient
from app.models import GraphEntity, GraphRelationship

logger = logging.getLogger(__name__)


class KnowledgeGraphService:
    """High-level graph operations built on top of the shared Neo4jClient."""

    def __init__(self, client: Neo4jClient) -> None:
        self._client = client

    async def upsert_entity(self, entity: GraphEntity) -> None:
        await self._client.execute_write(
            """
            MERGE (e:Entity {id: $id})
            SET e.name = $name,
                e.entity_type = $entity_type,
                e += $properties
            """,
            {
                "id": entity.id,
                "name": entity.name,
                "entity_type": entity.entity_type,
                "properties": entity.properties,
            },
        )

    async def upsert_relationship(self, rel: GraphRelationship) -> None:
        # Store relationship type as a property to avoid Cypher injection
        # through dynamic relationship labels.
        await self._client.execute_write(
            """
            MATCH (a:Entity {id: $source_id})
            MATCH (b:Entity {id: $target_id})
            MERGE (a)-[r:RELATES_TO {relationship_type: $rel_type}]->(b)
            SET r += $properties
            """,
            {
                "source_id": rel.source_id,
                "target_id": rel.target_id,
                "rel_type": rel.relationship_type,
                "properties": rel.properties,
            },
        )

    async def get_related_entities(
        self,
        entity_id: str,
        max_depth: int = 2,
        limit: int = 50,
    ) -> list[dict[str, object]]:
        return await self._client.execute_read(
            """
            MATCH path = (start:Entity {id: $entity_id})-[*1..$max_depth]-(related:Entity)
            RETURN related.id AS id,
                   related.name AS name,
                   related.entity_type AS entity_type,
                   length(path) AS distance
            ORDER BY distance
            LIMIT $limit
            """,
            {"entity_id": entity_id, "max_depth": max_depth, "limit": limit},
        )

    async def get_subgraph(
        self, topic: str, limit: int = 100
    ) -> dict[str, list[dict[str, object]]]:
        records = await self._client.execute_read(
            """
            MATCH (e:Entity)
            WHERE toLower(e.name) CONTAINS toLower($topic)
               OR toLower(e.entity_type) CONTAINS toLower($topic)
            WITH e LIMIT $limit
            OPTIONAL MATCH (e)-[r:RELATES_TO]-(neighbor:Entity)
            RETURN e.id AS entity_id,
                   e.name AS entity_name,
                   e.entity_type AS entity_type,
                   collect(DISTINCT {
                       neighbor_id: neighbor.id,
                       neighbor_name: neighbor.name,
                       neighbor_type: neighbor.entity_type,
                       relationship: r.relationship_type
                   }) AS connections
            """,
            {"topic": topic, "limit": limit},
        )

        entities: list[dict[str, object]] = []
        relationships: list[dict[str, object]] = []
        seen_rels: set[str] = set()

        for record in records:
            entities.append(
                {
                    "id": record["entity_id"],
                    "name": record["entity_name"],
                    "type": record["entity_type"],
                }
            )
            for conn in record["connections"]:
                if conn.get("neighbor_id") is None:
                    continue
                rel_key = f"{record['entity_id']}-{conn['neighbor_id']}-{conn['relationship']}"
                if rel_key not in seen_rels:
                    seen_rels.add(rel_key)
                    relationships.append(
                        {
                            "source": record["entity_id"],
                            "target": conn["neighbor_id"],
                            "type": conn["relationship"],
                        }
                    )

        return {"entities": entities, "relationships": relationships}

    async def detect_technology_signals(self, technology: str) -> list[dict[str, object]]:
        """Query graph for technology trend signals: patent growth, startup
        clusters, and research publication density around a technology node."""
        records = await self._client.execute_read(
            """
            MATCH (tech:Entity)
            WHERE toLower(tech.name) CONTAINS toLower($technology)
              AND tech.entity_type IN ['technology', 'platform', 'framework',
                                       'TECHNOLOGY']
            OPTIONAL MATCH (tech)<-[:RELATES_TO {relationship_type: 'patents'}]-(patent:Entity)
            OPTIONAL MATCH (tech)<-[:RELATES_TO {relationship_type: 'develops'}]-(startup:Entity)
            WHERE startup.entity_type IN ['startup', 'STARTUP']
            OPTIONAL MATCH (tech)<-[:RELATES_TO {relationship_type: 'researches'}]-(org:Entity)
            WHERE org.entity_type IN ['research_org', 'RESEARCH_TOPIC']
            RETURN tech.name AS technology,
                   count(DISTINCT patent) AS patent_count,
                   count(DISTINCT startup) AS startup_count,
                   count(DISTINCT org) AS research_org_count,
                   collect(DISTINCT startup.name)[..5] AS top_startups,
                   collect(DISTINCT org.name)[..5] AS top_research_orgs
            """,
            {"technology": technology},
        )

        signals: list[dict[str, object]] = []
        for record in records:
            if record["patent_count"] > 0:
                signals.append(
                    {
                        "type": "patent_growth",
                        "description": (
                            f"{record['patent_count']} patent entities linked to "
                            f"{record['technology']}"
                        ),
                        "count": record["patent_count"],
                    }
                )
            if record["startup_count"] > 0:
                signals.append(
                    {
                        "type": "startup_activity",
                        "description": (
                            f"{record['startup_count']} startups developing "
                            f"{record['technology']}: "
                            f"{', '.join(record['top_startups'])}"
                        ),
                        "count": record["startup_count"],
                    }
                )
            if record["research_org_count"] > 0:
                signals.append(
                    {
                        "type": "research_momentum",
                        "description": (
                            f"{record['research_org_count']} research orgs studying "
                            f"{record['technology']}: "
                            f"{', '.join(record['top_research_orgs'])}"
                        ),
                        "count": record["research_org_count"],
                    }
                )

        return signals

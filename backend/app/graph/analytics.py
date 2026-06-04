"""Knowledge graph analytics: landscape analysis, ecosystem mapping, trends."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from app.core.neo4j_client import Neo4jClient

logger = logging.getLogger(__name__)


@dataclass
class TechnologyCluster:
    """A cluster of related technologies."""

    name: str
    technologies: list[str]
    connection_count: int
    central_technology: str


@dataclass
class StartupProfile:
    """A startup discovered in the knowledge graph."""

    name: str
    technologies: list[str]
    relationships: list[dict[str, str]]
    properties: dict[str, object] = field(default_factory=dict)


@dataclass
class PatentTrend:
    """Patent filing trend for a technology area."""

    technology: str
    patent_count: int
    growth_rate: float  # percentage change
    top_filers: list[str]


@dataclass
class ResearchMomentum:
    """Research activity score for a technology area."""

    technology: str
    publication_count: int
    research_org_count: int
    citation_velocity: float  # normalized score 0-1
    top_researchers: list[str]


@dataclass
class CompetitiveIntelligence:
    """Who is investing in what — company-to-technology mapping."""

    company: str
    investments: list[dict[str, object]]
    technology_areas: list[str]
    relationship_types: list[str]


class GraphAnalytics:
    """Advanced graph analytics over the Neo4j knowledge graph."""

    def __init__(self, client: Neo4jClient) -> None:
        self._client = client

    async def technology_landscape(
        self, domain: str, min_connections: int = 2
    ) -> list[TechnologyCluster]:
        """Cluster related technologies within a domain.

        Finds technology nodes matching the domain, then groups them by
        shared connections (co-occurrence through shared neighbors).
        """
        records = await self._client.execute_read(
            """
            MATCH (t:Entity)
            WHERE t.entity_type IN ['TECHNOLOGY', 'technology', 'platform', 'framework']
              AND (toLower(t.name) CONTAINS toLower($domain)
                   OR EXISTS {
                       MATCH (t)-[:RELATES_TO]->(neighbor:Entity)
                       WHERE toLower(neighbor.name) CONTAINS toLower($domain)
                   })
            WITH t
            OPTIONAL MATCH (t)-[r:RELATES_TO]-(connected:Entity)
            WHERE connected.entity_type IN ['TECHNOLOGY', 'technology', 'platform', 'framework']
            WITH t, collect(DISTINCT connected.name) AS connected_techs,
                 count(DISTINCT r) AS connection_count
            WHERE connection_count >= $min_connections
            RETURN t.name AS technology,
                   connected_techs,
                   connection_count
            ORDER BY connection_count DESC
            LIMIT 50
            """,
            {"domain": domain, "min_connections": min_connections},
        )

        # Group technologies into clusters based on shared connections
        clusters: list[TechnologyCluster] = []
        seen: set[str] = set()

        for record in records:
            tech_name: str = record["technology"]
            if tech_name in seen:
                continue

            connected: list[str] = record["connected_techs"]
            cluster_techs = [tech_name] + [
                t for t in connected if t not in seen
            ]

            for t in cluster_techs:
                seen.add(t)

            clusters.append(
                TechnologyCluster(
                    name=f"{domain} - {tech_name} cluster",
                    technologies=cluster_techs,
                    connection_count=record["connection_count"],
                    central_technology=tech_name,
                )
            )

        logger.info(
            "Technology landscape for '%s': %d clusters found", domain, len(clusters)
        )
        return clusters

    async def startup_ecosystem(
        self, technology: str, limit: int = 20
    ) -> list[StartupProfile]:
        """Find startups working in a technology area."""
        records = await self._client.execute_read(
            """
            MATCH (s:Entity)-[r:RELATES_TO]-(tech:Entity)
            WHERE s.entity_type IN ['STARTUP', 'startup']
              AND (toLower(tech.name) CONTAINS toLower($technology)
                   OR toLower(r.relationship_type) CONTAINS toLower($technology))
            WITH s, collect(DISTINCT {
                technology: tech.name,
                relationship: r.relationship_type
            }) AS tech_rels
            RETURN s.name AS startup_name,
                   s.properties AS properties,
                   tech_rels
            ORDER BY size(tech_rels) DESC
            LIMIT $limit
            """,
            {"technology": technology, "limit": limit},
        )

        startups: list[StartupProfile] = []
        for record in records:
            tech_rels: list[dict[str, str]] = record["tech_rels"]
            startups.append(
                StartupProfile(
                    name=record["startup_name"],
                    technologies=[tr["technology"] for tr in tech_rels],
                    relationships=tech_rels,
                    properties=dict(record.get("properties") or {}),
                )
            )

        logger.info(
            "Startup ecosystem for '%s': %d startups found", technology, len(startups)
        )
        return startups

    async def patent_trends(self, technology: str) -> list[PatentTrend]:
        """Detect patent filing trends for a technology area.

        Queries patent entities linked to the technology and estimates growth
        rate based on entity counts and filer diversity.
        """
        records = await self._client.execute_read(
            """
            MATCH (patent:Entity)-[r:RELATES_TO]-(tech:Entity)
            WHERE patent.entity_type IN ['PATENT', 'patent']
              AND toLower(tech.name) CONTAINS toLower($technology)
            WITH tech.name AS technology,
                 count(DISTINCT patent) AS patent_count,
                 collect(DISTINCT patent.name)[..10] AS patent_names
            OPTIONAL MATCH (filer:Entity)-[:RELATES_TO {relationship_type: 'patents'}]->(p:Entity)
            WHERE p.entity_type IN ['PATENT', 'patent']
              AND EXISTS {
                  MATCH (p)-[:RELATES_TO]-(t:Entity)
                  WHERE toLower(t.name) CONTAINS toLower($technology)
              }
            WITH technology, patent_count, patent_names,
                 collect(DISTINCT filer.name)[..5] AS top_filers
            RETURN technology, patent_count, patent_names, top_filers
            """,
            {"technology": technology},
        )

        trends: list[PatentTrend] = []
        for record in records:
            count: int = record.get("patent_count", 0)
            # Estimate growth rate: use filer diversity as a proxy
            filers: list[str] = record.get("top_filers") or []
            growth_rate = min(count * 0.1, 100.0) if count > 0 else 0.0

            trends.append(
                PatentTrend(
                    technology=record["technology"],
                    patent_count=count,
                    growth_rate=growth_rate,
                    top_filers=filers,
                )
            )

        return trends

    async def research_momentum(self, technology: str) -> list[ResearchMomentum]:
        """Score research activity: publication rate, organization count,
        citation velocity proxy."""
        records = await self._client.execute_read(
            """
            MATCH (org:Entity)-[r:RELATES_TO]-(tech:Entity)
            WHERE org.entity_type IN ['RESEARCH_TOPIC', 'research_org']
              AND toLower(tech.name) CONTAINS toLower($technology)
            WITH tech.name AS technology,
                 count(DISTINCT org) AS research_org_count,
                 collect(DISTINCT org.name)[..10] AS researchers
            OPTIONAL MATCH (pub:Entity)-[:RELATES_TO]-(tech2:Entity)
            WHERE pub.entity_type IN ['PATENT', 'patent', 'RESEARCH_TOPIC']
              AND toLower(tech2.name) CONTAINS toLower($technology)
            WITH technology, research_org_count, researchers,
                 count(DISTINCT pub) AS publication_count
            RETURN technology, research_org_count, researchers, publication_count
            """,
            {"technology": technology},
        )

        momentum: list[ResearchMomentum] = []
        for record in records:
            org_count: int = record.get("research_org_count", 0)
            pub_count: int = record.get("publication_count", 0)

            # Citation velocity proxy: normalized score based on volume
            velocity = min((org_count * pub_count) / 100.0, 1.0) if org_count > 0 else 0.0

            momentum.append(
                ResearchMomentum(
                    technology=record["technology"],
                    publication_count=pub_count,
                    research_org_count=org_count,
                    citation_velocity=velocity,
                    top_researchers=record.get("researchers") or [],
                )
            )

        return momentum

    async def competitive_intelligence(
        self, technology: str, limit: int = 20
    ) -> list[CompetitiveIntelligence]:
        """Find which companies are investing in a technology area and how."""
        records = await self._client.execute_read(
            """
            MATCH (company:Entity)-[r:RELATES_TO]-(tech:Entity)
            WHERE company.entity_type IN ['COMPANY', 'company', 'STARTUP', 'startup']
              AND toLower(tech.name) CONTAINS toLower($technology)
            WITH company, collect(DISTINCT {
                technology: tech.name,
                relationship: r.relationship_type,
                properties: r.properties
            }) AS investments
            RETURN company.name AS company_name,
                   investments,
                   [inv IN investments | inv.technology] AS technology_areas,
                   [inv IN investments | inv.relationship] AS relationship_types
            ORDER BY size(investments) DESC
            LIMIT $limit
            """,
            {"technology": technology, "limit": limit},
        )

        results: list[CompetitiveIntelligence] = []
        for record in records:
            results.append(
                CompetitiveIntelligence(
                    company=record["company_name"],
                    investments=record["investments"],
                    technology_areas=record["technology_areas"],
                    relationship_types=record["relationship_types"],
                )
            )

        logger.info(
            "Competitive intelligence for '%s': %d companies found",
            technology,
            len(results),
        )
        return results

"""Agent tool definitions for structured tool use within the agent system."""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import ClassVar

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Base tool interface
# ---------------------------------------------------------------------------


class ToolResult(BaseModel):
    """Standard result envelope returned by every tool."""

    success: bool = True
    data: dict[str, object] = Field(default_factory=dict)
    error: str | None = None


class BaseTool(ABC):
    """All agent tools inherit from this to provide a uniform interface."""

    name: ClassVar[str] = "base_tool"
    description: ClassVar[str] = ""

    @abstractmethod
    async def execute(self, **kwargs: object) -> ToolResult: ...


# ---------------------------------------------------------------------------
# Input schemas
# ---------------------------------------------------------------------------


class WebSearchInput(BaseModel):
    """Input schema for web search queries."""

    query: str = Field(..., min_length=1, max_length=500, description="Search query")
    max_results: int = Field(default=5, ge=1, le=20, description="Maximum results to return")


class DatabaseQueryInput(BaseModel):
    """Input schema for knowledge graph queries."""

    topic: str = Field(
        ..., min_length=1, max_length=300, description="Topic to query in the knowledge graph"
    )
    entity_type: str | None = Field(default=None, description="Filter by entity type")
    max_depth: int = Field(default=2, ge=1, le=5, description="Max traversal depth")
    limit: int = Field(default=50, ge=1, le=200, description="Maximum entities to return")


class DocumentSearchInput(BaseModel):
    """Input schema for RAG document search."""

    query: str = Field(..., min_length=1, max_length=1000, description="Search query for documents")
    top_k: int = Field(default=10, ge=1, le=50, description="Number of results")
    search_type: str = Field(
        default="hybrid",
        description="Search method: 'semantic', 'keyword', or 'hybrid'",
    )


class CalculatorInput(BaseModel):
    """Input schema for confidence score calculations."""

    scores: list[float] = Field(
        ..., min_length=1, description="List of confidence scores (0.0-1.0)"
    )
    weights: list[float] | None = Field(
        default=None,
        description="Optional weights for each score (must match scores length)",
    )
    operation: str = Field(
        default="weighted_average",
        description="Calculation: 'weighted_average', 'harmonic_mean', 'min', 'max'",
    )


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------


class WebSearchTool(BaseTool):
    """Structured tool for agents to search the web.

    Currently returns mock results; swap the execute body for a real search
    API integration (e.g. Tavily, Serper, SerpAPI).
    """

    name: ClassVar[str] = "web_search"
    description: ClassVar[str] = (
        "Search the web for recent information about technologies, companies, "
        "markets, and trends. Returns a list of search result snippets."
    )

    async def execute(self, **kwargs: object) -> ToolResult:
        parsed = WebSearchInput(**kwargs)  # type: ignore[arg-type]

        # Placeholder mock results
        mock_results: list[dict[str, str]] = [
            {
                "title": f"Result {i + 1} for: {parsed.query}",
                "snippet": (
                    f"Mock search snippet #{i + 1} related to '{parsed.query}'. "
                    "Replace with real search API integration."
                ),
                "url": f"https://example.com/result/{i + 1}",
            }
            for i in range(min(parsed.max_results, 5))
        ]

        logger.info("WebSearchTool: executed query=%r, results=%d", parsed.query, len(mock_results))

        return ToolResult(
            success=True,
            data={"results": mock_results, "query": parsed.query},  # type: ignore[dict-item]
        )


class DatabaseQueryTool(BaseTool):
    """Tool for agents to query the knowledge graph via Neo4j."""

    name: ClassVar[str] = "database_query"
    description: ClassVar[str] = (
        "Query the knowledge graph to find entities (technologies, companies, "
        "startups, markets) and their relationships."
    )

    def __init__(self, graph_service: object | None = None) -> None:
        self._graph_service = graph_service

    async def execute(self, **kwargs: object) -> ToolResult:
        parsed = DatabaseQueryInput(**kwargs)  # type: ignore[arg-type]

        if self._graph_service is None:
            return ToolResult(
                success=False,
                error="Knowledge graph service not configured",
            )

        try:
            from app.graph.service import KnowledgeGraphService

            service: KnowledgeGraphService = self._graph_service  # type: ignore[assignment]
            subgraph = await service.get_subgraph(parsed.topic, limit=parsed.limit)

            return ToolResult(
                success=True,
                data={
                    "entities": subgraph.get("entities", []),  # type: ignore[dict-item]
                    "relationships": subgraph.get("relationships", []),  # type: ignore[dict-item]
                    "topic": parsed.topic,
                },
            )
        except Exception as exc:
            logger.exception("DatabaseQueryTool failed for topic=%s", parsed.topic)
            return ToolResult(success=False, error=str(exc))


class DocumentSearchTool(BaseTool):
    """Tool for agents to search RAG document store."""

    name: ClassVar[str] = "document_search"
    description: ClassVar[str] = (
        "Search the ingested document corpus using semantic search, keyword "
        "search, or hybrid (both combined via reciprocal rank fusion)."
    )

    def __init__(self, db_session: object | None = None) -> None:
        self._db_session = db_session

    async def execute(self, **kwargs: object) -> ToolResult:
        parsed = DocumentSearchInput(**kwargs)  # type: ignore[arg-type]

        if self._db_session is None:
            return ToolResult(
                success=False,
                error="Database session not configured",
            )

        try:
            from sqlalchemy.ext.asyncio import AsyncSession

            from app.rag.retriever import hybrid_search, keyword_search, semantic_search

            db: AsyncSession = self._db_session  # type: ignore[assignment]

            if parsed.search_type == "semantic":
                results = await semantic_search(parsed.query, db, top_k=parsed.top_k)
            elif parsed.search_type == "keyword":
                results = await keyword_search(parsed.query, db, top_k=parsed.top_k)
            else:
                results = await hybrid_search(parsed.query, db, top_k=parsed.top_k)

            chunks: list[dict[str, object]] = [
                {
                    "document_id": r.document_id,
                    "chunk_id": r.chunk_id,
                    "title": r.title,
                    "content": r.content[:500],
                    "relevance_score": r.relevance_score,
                }
                for r in results
            ]

            return ToolResult(
                success=True,
                data={
                    "chunks": chunks,  # type: ignore[dict-item]
                    "total": len(chunks),
                    "search_type": parsed.search_type,
                },
            )
        except Exception as exc:
            logger.exception("DocumentSearchTool failed for query=%s", parsed.query)
            return ToolResult(success=False, error=str(exc))


class CalculatorTool(BaseTool):
    """Tool for confidence score calculations and aggregation."""

    name: ClassVar[str] = "calculator"
    description: ClassVar[str] = (
        "Calculate aggregated confidence scores from multiple inputs. "
        "Supports weighted average, harmonic mean, min, and max operations."
    )

    async def execute(self, **kwargs: object) -> ToolResult:
        parsed = CalculatorInput(**kwargs)  # type: ignore[arg-type]

        scores = parsed.scores
        weights = parsed.weights

        if weights is not None and len(weights) != len(scores):
            return ToolResult(
                success=False,
                error=f"Weights length ({len(weights)}) must match scores length ({len(scores)})",
            )

        # Validate score range
        for s in scores:
            if not 0.0 <= s <= 1.0:
                return ToolResult(
                    success=False,
                    error=f"All scores must be between 0.0 and 1.0, got {s}",
                )

        result: float

        if parsed.operation == "weighted_average":
            if weights is None:
                weights = [1.0] * len(scores)
            total_weight = sum(weights)
            if total_weight == 0:
                return ToolResult(success=False, error="Total weight cannot be zero")
            result = sum(s * w for s, w in zip(scores, weights, strict=False)) / total_weight

        elif parsed.operation == "harmonic_mean":
            if any(s == 0 for s in scores):
                result = 0.0
            else:
                n = len(scores)
                result = n / sum(1.0 / s for s in scores)

        elif parsed.operation == "min":
            result = min(scores)

        elif parsed.operation == "max":
            result = max(scores)

        else:
            return ToolResult(
                success=False,
                error=f"Unknown operation: {parsed.operation}",
            )

        return ToolResult(
            success=True,
            data={
                "result": result,
                "operation": parsed.operation,
                "input_count": len(scores),
            },
        )


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

TOOL_REGISTRY: dict[str, type[BaseTool]] = {
    "web_search": WebSearchTool,
    "database_query": DatabaseQueryTool,
    "document_search": DocumentSearchTool,
    "calculator": CalculatorTool,
}


def get_tool(name: str, **init_kwargs: object) -> BaseTool:
    """Instantiate a tool by registered name."""
    cls = TOOL_REGISTRY.get(name)
    if cls is None:
        raise ValueError(f"Unknown tool: {name}. Available: {list(TOOL_REGISTRY)}")
    return cls(**init_kwargs)  # type: ignore[arg-type]

"""Shared pytest fixtures for the Innovation Intelligence Copilot test suite."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

# ---------------------------------------------------------------------------
# FastAPI async test client
# ---------------------------------------------------------------------------


@pytest.fixture
async def app():
    """Create a FastAPI application instance for testing."""
    from app.main import app as fastapi_app

    yield fastapi_app


@pytest.fixture
async def client(app) -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client wired to the FastAPI app (no network I/O)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ---------------------------------------------------------------------------
# Mock database session
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_db_session() -> AsyncMock:
    """Return a mock async database session with common methods stubbed."""
    session = AsyncMock(spec=AsyncSession)
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.close = AsyncMock()
    session.execute = AsyncMock()
    session.add = MagicMock()
    session.delete = AsyncMock()
    session.refresh = AsyncMock()
    return session


# ---------------------------------------------------------------------------
# Sample domain fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def sample_document() -> dict[str, Any]:
    """A representative ingested document for test scenarios."""
    return {
        "id": "doc_abc123",
        "title": "Advances in Microbial Fermentation for Sustainable Chemicals",
        "source": "Nature Biotechnology",
        "source_type": "journal_article",
        "content": (
            "Recent breakthroughs in microbial fermentation have demonstrated "
            "commercially viable pathways to produce bio-based adipic acid, "
            "succinic acid, and 1,4-butanediol at scale. BASF and Genomatica "
            "announced a joint venture to bring fermentation-derived BDO to "
            "market by 2026, targeting 100 kt/yr capacity."
        ),
        "metadata": {
            "authors": ["Zhang, L.", "Kumar, A.", "Patel, R."],
            "published_date": "2024-06-15",
            "doi": "10.1038/s41587-024-02300-1",
            "keywords": [
                "microbial fermentation",
                "bio-based chemicals",
                "sustainable manufacturing",
            ],
        },
        "chunk_count": 12,
    }


@pytest.fixture
def sample_analysis_request() -> dict[str, Any]:
    """A representative analysis request payload."""
    return {
        "query": (
            "What is the commercial viability of microbial fermentation "
            "for producing bio-based adipic acid? Evaluate BASF's position "
            "relative to emerging startups."
        ),
        "context": {
            "industry": "chemicals",
            "focus_areas": [
                "biotechnology",
                "sustainable manufacturing",
                "fermentation",
            ],
            "time_horizon_years": 5,
            "include_risk_analysis": True,
            "include_contrarian_view": True,
        },
        "agents": [
            "research",
            "support",
            "skeptic",
            "risk",
            "trend",
            "executive",
        ],
        "output_format": "full_report",
    }


@pytest.fixture
def sample_analysis_result() -> dict[str, Any]:
    """A representative analysis result for response validation."""
    return {
        "id": "analysis_xyz789",
        "status": "completed",
        "query": (
            "What is the commercial viability of microbial fermentation "
            "for producing bio-based adipic acid?"
        ),
        "recommendation": "INVEST_WITH_CAUTION",
        "confidence_score": 72,
        "executive_summary": (
            "Microbial fermentation for bio-based adipic acid shows strong "
            "technical promise but faces significant scale-up challenges. "
            "BASF holds a competitive advantage through its Genomatica partnership, "
            "but three well-funded startups are approaching pilot scale."
        ),
        "supporting_evidence": [
            {
                "claim": "Genomatica has demonstrated fermentation-derived BDO at pilot scale",
                "sources": ["doc_abc123"],
                "confidence": 0.92,
            },
        ],
        "contrarian_evidence": [
            {
                "claim": "Petrochemical adipic acid costs remain 40% lower than bio-based routes",
                "sources": ["doc_def456"],
                "confidence": 0.85,
            },
        ],
        "risks": [
            {
                "description": "Feedstock price volatility could erode margin advantage",
                "category": "market",
                "severity": "medium",
                "likelihood": "likely",
            },
        ],
        "agent_traces": [
            {
                "agent_name": "research",
                "duration_ms": 3200.0,
                "error": None,
            },
            {
                "agent_name": "skeptic",
                "duration_ms": 2800.0,
                "error": None,
            },
        ],
    }


@pytest.fixture
def sample_document_chunks() -> list[dict[str, Any]]:
    """Pre-chunked document fragments for RAG pipeline tests."""
    return [
        {
            "id": "chunk_001",
            "document_id": "doc_abc123",
            "content": (
                "Recent breakthroughs in microbial fermentation have demonstrated "
                "commercially viable pathways to produce bio-based adipic acid."
            ),
            "chunk_index": 0,
            "metadata": {
                "page": 1,
                "section": "Abstract",
            },
        },
        {
            "id": "chunk_002",
            "document_id": "doc_abc123",
            "content": (
                "BASF and Genomatica announced a joint venture to bring "
                "fermentation-derived BDO to market by 2026, targeting "
                "100 kt/yr capacity."
            ),
            "chunk_index": 1,
            "metadata": {
                "page": 3,
                "section": "Industry Developments",
            },
        },
        {
            "id": "chunk_003",
            "document_id": "doc_abc123",
            "content": (
                "The economic analysis shows a break-even point at crude oil "
                "prices above $85/barrel, assuming corn-based glucose feedstock "
                "at current commodity prices."
            ),
            "chunk_index": 2,
            "metadata": {
                "page": 7,
                "section": "Economic Analysis",
            },
        },
    ]

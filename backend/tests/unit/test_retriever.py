"""Tests for the hybrid retriever."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.rag.retriever import (
    RetrievedChunk,
    _reciprocal_rank_fusion,
    chunks_to_citations,
    hybrid_search,
    keyword_search,
    semantic_search,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def sample_chunks() -> list[RetrievedChunk]:
    """A set of representative retrieved chunks."""
    return [
        RetrievedChunk(
            document_id="doc_001",
            chunk_id="chunk_001",
            content="Quantum computing enables molecular simulation at scale.",
            title="Quantum Overview",
            relevance_score=0.92,
            metadata={"page": 1},
        ),
        RetrievedChunk(
            document_id="doc_002",
            chunk_id="chunk_002",
            content="Classical HPC remains competitive for many chemistry problems.",
            title="Classical Computing",
            relevance_score=0.75,
            metadata={"page": 3},
        ),
        RetrievedChunk(
            document_id="doc_003",
            chunk_id="chunk_003",
            content="Error correction is the key bottleneck for quantum advantage.",
            title="QC Challenges",
            relevance_score=0.88,
            metadata={"page": 5},
        ),
    ]


@pytest.fixture
def semantic_results() -> list[RetrievedChunk]:
    """Simulated semantic search results."""
    return [
        RetrievedChunk(
            document_id="doc_001",
            chunk_id="chunk_s1",
            content="Semantic result 1",
            title="Doc A",
            relevance_score=0.95,
            metadata={},
        ),
        RetrievedChunk(
            document_id="doc_002",
            chunk_id="chunk_s2",
            content="Semantic result 2",
            title="Doc B",
            relevance_score=0.80,
            metadata={},
        ),
        RetrievedChunk(
            document_id="doc_003",
            chunk_id="chunk_shared",
            content="Shared result across both methods",
            title="Doc C",
            relevance_score=0.70,
            metadata={},
        ),
    ]


@pytest.fixture
def keyword_results() -> list[RetrievedChunk]:
    """Simulated keyword search results."""
    return [
        RetrievedChunk(
            document_id="doc_004",
            chunk_id="chunk_k1",
            content="Keyword result 1",
            title="Doc D",
            relevance_score=0.85,
            metadata={},
        ),
        RetrievedChunk(
            document_id="doc_003",
            chunk_id="chunk_shared",
            content="Shared result across both methods",
            title="Doc C",
            relevance_score=0.65,
            metadata={},
        ),
        RetrievedChunk(
            document_id="doc_005",
            chunk_id="chunk_k2",
            content="Keyword result 2",
            title="Doc E",
            relevance_score=0.50,
            metadata={},
        ),
    ]


# ---------------------------------------------------------------------------
# Test: RRF score fusion
# ---------------------------------------------------------------------------


class TestReciprocalRankFusion:
    """Tests for the Reciprocal Rank Fusion algorithm."""

    @pytest.mark.unit
    def test_rrf_merges_two_lists(
        self,
        semantic_results: list[RetrievedChunk],
        keyword_results: list[RetrievedChunk],
    ) -> None:
        """RRF should merge results from both lists without duplicates."""
        fused = _reciprocal_rank_fusion([semantic_results, keyword_results])

        chunk_ids = [c.chunk_id for c in fused]
        # All unique chunks should appear
        assert len(set(chunk_ids)) == 5  # 3 semantic + 3 keyword - 1 shared
        # No duplicates
        assert len(chunk_ids) == len(set(chunk_ids))

    @pytest.mark.unit
    def test_rrf_shared_item_ranked_higher(
        self,
        semantic_results: list[RetrievedChunk],
        keyword_results: list[RetrievedChunk],
    ) -> None:
        """An item appearing in both lists should get a higher RRF score."""
        fused = _reciprocal_rank_fusion([semantic_results, keyword_results])

        shared_chunk = next(c for c in fused if c.chunk_id == "chunk_shared")
        # The shared chunk appears in both lists, so its RRF score should be
        # higher than items appearing in only one list (at comparable ranks)
        only_keyword = next(c for c in fused if c.chunk_id == "chunk_k2")
        assert shared_chunk.relevance_score > only_keyword.relevance_score

    @pytest.mark.unit
    def test_rrf_empty_lists(self) -> None:
        """RRF with empty lists should return empty results."""
        fused = _reciprocal_rank_fusion([[], []])
        assert fused == []

    @pytest.mark.unit
    def test_rrf_single_list(
        self, semantic_results: list[RetrievedChunk]
    ) -> None:
        """RRF with a single list should return items in the same order."""
        fused = _reciprocal_rank_fusion([semantic_results])
        assert len(fused) == len(semantic_results)
        assert fused[0].chunk_id == semantic_results[0].chunk_id

    @pytest.mark.unit
    def test_rrf_k_constant_affects_scores(
        self, semantic_results: list[RetrievedChunk]
    ) -> None:
        """Different k_constant values should produce different score magnitudes."""
        fused_small_k = _reciprocal_rank_fusion([semantic_results], k_constant=10)
        fused_large_k = _reciprocal_rank_fusion([semantic_results], k_constant=100)

        # Smaller k gives higher scores (less dampening)
        assert fused_small_k[0].relevance_score > fused_large_k[0].relevance_score


# ---------------------------------------------------------------------------
# Test: Semantic search
# ---------------------------------------------------------------------------


class TestSemanticSearch:
    """Tests for semantic search."""

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_semantic_search_returns_ranked_results(self) -> None:
        """Semantic search should return chunks sorted by similarity."""
        mock_rows = [
            {
                "chunk_id": "c1",
                "document_id": "d1",
                "content": "High relevance content",
                "title": "Doc 1",
                "metadata": {},
                "similarity": 0.95,
            },
            {
                "chunk_id": "c2",
                "document_id": "d2",
                "content": "Lower relevance content",
                "title": "Doc 2",
                "metadata": {},
                "similarity": 0.70,
            },
        ]

        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.mappings.return_value.all.return_value = mock_rows
        mock_db.execute = AsyncMock(return_value=mock_result)

        with patch("app.rag.retriever.embed_text", new_callable=AsyncMock) as mock_embed:
            mock_embed.return_value = [0.1] * 1536
            results = await semantic_search("test query", mock_db, top_k=10)

        assert len(results) == 2
        assert results[0].relevance_score == 0.95
        assert results[1].relevance_score == 0.70
        assert results[0].chunk_id == "c1"


# ---------------------------------------------------------------------------
# Test: Keyword search fallback
# ---------------------------------------------------------------------------


class TestKeywordSearch:
    """Tests for keyword search."""

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_keyword_search_returns_results(self) -> None:
        """Keyword search should return chunks sorted by ts_rank."""
        mock_rows = [
            {
                "chunk_id": "c1",
                "document_id": "d1",
                "content": "Matching content with keywords",
                "title": "Doc 1",
                "metadata": {"section": "intro"},
                "rank": 0.85,
            },
        ]

        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.mappings.return_value.all.return_value = mock_rows
        mock_db.execute = AsyncMock(return_value=mock_result)

        results = await keyword_search("keywords test", mock_db, top_k=5)

        assert len(results) == 1
        assert results[0].relevance_score == 0.85
        assert results[0].metadata == {"section": "intro"}

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_keyword_search_no_matches(self) -> None:
        """Keyword search with no matches should return empty list."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.mappings.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=mock_result)

        results = await keyword_search("xyznonexistent", mock_db)
        assert results == []


# ---------------------------------------------------------------------------
# Test: Empty results handling
# ---------------------------------------------------------------------------


class TestEmptyResults:
    """Tests for edge cases with empty results."""

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_hybrid_search_empty_results(self) -> None:
        """Hybrid search should handle empty results from both methods."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.mappings.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=mock_result)

        with patch("app.rag.retriever.embed_text", new_callable=AsyncMock) as mock_embed:
            mock_embed.return_value = [0.1] * 1536
            results = await hybrid_search("test empty", mock_db, top_k=10)

        assert results == []

    @pytest.mark.unit
    def test_chunks_to_citations_empty(self) -> None:
        """chunks_to_citations should handle empty list."""
        citations = chunks_to_citations([])
        assert citations == []

    @pytest.mark.unit
    def test_chunks_to_citations_truncates_content(
        self, sample_chunks: list[RetrievedChunk]
    ) -> None:
        """Citations should truncate chunk_text to 300 chars."""
        long_chunk = RetrievedChunk(
            document_id="d1",
            chunk_id="c1",
            content="x" * 500,
            title="Long doc",
            relevance_score=0.9,
            metadata={},
        )
        citations = chunks_to_citations([long_chunk])
        assert len(citations) == 1
        assert len(citations[0].chunk_text) == 300

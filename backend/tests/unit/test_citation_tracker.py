"""Tests for the citation tracker."""

from __future__ import annotations

import pytest

from app.rag.citation_tracker import (
    AnnotatedClaim,
    Citation,
    CitationReport,
    CitationTracker,
    _extract_word_set,
    _word_overlap_ratio,
)
from app.rag.retriever import RetrievedChunk


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def source_chunks() -> list[RetrievedChunk]:
    """Source chunks that claims should be matched against."""
    return [
        RetrievedChunk(
            document_id="doc_001",
            chunk_id="chunk_001",
            content=(
                "Quantum computing enables molecular simulation at unprecedented "
                "scale, allowing researchers to model complex protein folding "
                "interactions that classical computers cannot handle."
            ),
            title="Quantum Computing for Drug Discovery",
            relevance_score=0.92,
            metadata={"page": 1},
        ),
        RetrievedChunk(
            document_id="doc_002",
            chunk_id="chunk_002",
            content=(
                "BASF and Genomatica have partnered to develop bio-based "
                "1,4-butanediol using microbial fermentation technology. "
                "The joint venture targets 100 kt per year capacity by 2026."
            ),
            title="Bio-Based Chemicals Market",
            relevance_score=0.85,
            metadata={"page": 3},
        ),
        RetrievedChunk(
            document_id="doc_003",
            chunk_id="chunk_003",
            content=(
                "Error correction remains the primary bottleneck for achieving "
                "quantum advantage in real-world applications. Current qubit "
                "coherence times are insufficient for complex calculations."
            ),
            title="Quantum Computing Challenges",
            relevance_score=0.78,
            metadata={"page": 5},
        ),
    ]


@pytest.fixture
def tracker(source_chunks: list[RetrievedChunk]) -> CitationTracker:
    return CitationTracker(source_chunks)


# ---------------------------------------------------------------------------
# Test: Citation assignment
# ---------------------------------------------------------------------------


class TestCitationAssignment:
    """Tests for assigning citations to claims."""

    @pytest.mark.unit
    def test_matching_claim_gets_citation(
        self, tracker: CitationTracker
    ) -> None:
        """A claim with overlapping words should get a citation."""
        claims = [
            "Quantum computing enables molecular simulation at scale"
        ]
        report = tracker.track(claims)

        assert len(report.annotated_claims) == 1
        assert len(report.annotated_claims[0].citation_ids) > 0
        assert report.annotated_claims[0].is_supported is True

    @pytest.mark.unit
    def test_multiple_claims_get_correct_citations(
        self, tracker: CitationTracker
    ) -> None:
        """Multiple claims should each get citations from relevant chunks."""
        claims = [
            "Quantum computing enables molecular simulation for drug discovery",
            "BASF and Genomatica partnered for bio-based butanediol fermentation",
            "Error correction is the bottleneck for quantum advantage",
        ]
        report = tracker.track(claims)

        assert len(report.annotated_claims) == 3
        for ac in report.annotated_claims:
            assert ac.is_supported is True
            assert len(ac.citation_ids) >= 1

    @pytest.mark.unit
    def test_claim_matching_multiple_chunks(
        self, tracker: CitationTracker
    ) -> None:
        """A claim mentioning terms from multiple chunks should get multiple citations."""
        claims = [
            "Quantum computing molecular simulation faces error correction bottleneck challenges"
        ]
        report = tracker.track(claims)

        assert len(report.annotated_claims) == 1
        # Should match both chunk_001 (quantum, molecular, simulation) and
        # chunk_003 (error, correction, bottleneck)
        assert len(report.annotated_claims[0].citation_ids) >= 2

    @pytest.mark.unit
    def test_citation_ids_are_unique_per_chunk(
        self, tracker: CitationTracker
    ) -> None:
        """Each unique source chunk should have a unique citation ID."""
        claims = [
            "Quantum computing molecular simulation",
            "Quantum computing molecular simulation duplicate",
        ]
        report = tracker.track(claims)

        # Both claims reference the same chunk, so they should share the citation ID
        all_ids: set[int] = set()
        for ac in report.annotated_claims:
            all_ids.update(ac.citation_ids)

        # The bibliography should not have duplicate entries for the same chunk
        bib_chunk_ids = [c.chunk_id for c in report.bibliography]
        assert len(bib_chunk_ids) == len(set(bib_chunk_ids))


# ---------------------------------------------------------------------------
# Test: Bibliography generation
# ---------------------------------------------------------------------------


class TestBibliography:
    """Tests for bibliography generation."""

    @pytest.mark.unit
    def test_bibliography_contains_all_cited_sources(
        self, tracker: CitationTracker
    ) -> None:
        """The bibliography should list every cited source exactly once."""
        claims = [
            "Quantum computing enables molecular simulation",
            "BASF Genomatica bio-based fermentation butanediol",
        ]
        report = tracker.track(claims)

        assert len(report.bibliography) >= 2
        doc_ids = {c.document_id for c in report.bibliography}
        assert "doc_001" in doc_ids
        assert "doc_002" in doc_ids

    @pytest.mark.unit
    def test_bibliography_format(self, tracker: CitationTracker) -> None:
        """The formatted bibliography should include citation IDs and titles."""
        claims = ["Quantum computing molecular simulation"]
        report = tracker.track(claims)

        formatted = tracker.format_bibliography(report)
        assert "References" in formatted
        assert "[1]" in formatted
        assert "Quantum Computing" in formatted

    @pytest.mark.unit
    def test_empty_bibliography(self, tracker: CitationTracker) -> None:
        """Empty claims should produce an empty bibliography."""
        report = tracker.track([])
        assert report.bibliography == []
        formatted = tracker.format_bibliography(report)
        assert "No sources cited" in formatted

    @pytest.mark.unit
    def test_bibliography_citation_ids_sequential(
        self, tracker: CitationTracker
    ) -> None:
        """Citation IDs in the bibliography should be sequential starting at 1."""
        claims = [
            "Quantum computing molecular simulation drug discovery",
            "BASF Genomatica fermentation bio-based butanediol",
            "Error correction quantum advantage bottleneck",
        ]
        report = tracker.track(claims)

        ids = [c.citation_id for c in report.bibliography]
        assert ids == list(range(1, len(ids) + 1))


# ---------------------------------------------------------------------------
# Test: Unsupported claim detection
# ---------------------------------------------------------------------------


class TestUnsupportedClaims:
    """Tests for detecting claims without source support."""

    @pytest.mark.unit
    def test_unsupported_claim_detected(
        self, tracker: CitationTracker
    ) -> None:
        """Claims with no matching source should be flagged as unsupported."""
        claims = [
            "The weather in Antarctica is extremely cold in winter"
        ]
        report = tracker.track(claims)

        assert len(report.unsupported_claims) == 1
        assert report.unsupported_claims[0] == claims[0]
        assert report.annotated_claims[0].is_supported is False

    @pytest.mark.unit
    def test_mixed_supported_and_unsupported(
        self, tracker: CitationTracker
    ) -> None:
        """Mix of supported and unsupported claims should be classified correctly."""
        claims = [
            "Quantum computing enables molecular simulation at scale",
            "Pizza is the most popular food in Italy",
        ]
        report = tracker.track(claims)

        assert len(report.unsupported_claims) == 1
        assert "Pizza" in report.unsupported_claims[0]

        supported = [ac for ac in report.annotated_claims if ac.is_supported]
        unsupported = [ac for ac in report.annotated_claims if not ac.is_supported]
        assert len(supported) == 1
        assert len(unsupported) == 1

    @pytest.mark.unit
    def test_support_rate_calculation(
        self, tracker: CitationTracker
    ) -> None:
        """Support rate should be correctly computed."""
        claims = [
            "Quantum computing molecular simulation",
            "Totally unrelated claim about cooking recipes",
            "BASF Genomatica fermentation technology butanediol",
        ]
        report = tracker.track(claims)

        # 2 out of 3 claims should be supported
        assert 0.5 <= report.support_rate <= 1.0

    @pytest.mark.unit
    def test_all_unsupported(self, tracker: CitationTracker) -> None:
        """All unsupported claims should give 0% support rate."""
        claims = [
            "Cooking pasta requires boiling water",
            "Soccer is played with a round ball",
        ]
        report = tracker.track(claims)

        assert report.support_rate == 0.0
        assert len(report.unsupported_claims) == 2


# ---------------------------------------------------------------------------
# Test: Helper functions
# ---------------------------------------------------------------------------


class TestHelpers:
    """Tests for internal helper functions."""

    @pytest.mark.unit
    def test_extract_word_set(self) -> None:
        """Should extract words 3+ characters, lowercase."""
        words = _extract_word_set("Hello, World! This is a test of the system.")
        assert "hello" in words
        assert "world" in words
        assert "this" in words
        assert "test" in words
        assert "system" in words
        # Short words excluded
        assert "is" not in words
        assert "a" not in words
        assert "of" not in words

    @pytest.mark.unit
    def test_word_overlap_ratio_identical(self) -> None:
        """Identical sets should have overlap ratio 1.0."""
        set_a = {"quantum", "computing", "simulation"}
        set_b = {"quantum", "computing", "simulation"}
        assert _word_overlap_ratio(set_a, set_b) == 1.0

    @pytest.mark.unit
    def test_word_overlap_ratio_no_overlap(self) -> None:
        """Disjoint sets should have overlap ratio 0.0."""
        set_a = {"quantum", "computing"}
        set_b = {"cooking", "recipes"}
        assert _word_overlap_ratio(set_a, set_b) == 0.0

    @pytest.mark.unit
    def test_word_overlap_ratio_partial(self) -> None:
        """Partial overlap should give a ratio between 0 and 1."""
        set_a = {"quantum", "computing", "simulation"}
        set_b = {"quantum", "computing", "chemistry"}
        ratio = _word_overlap_ratio(set_a, set_b)
        assert 0.0 < ratio < 1.0

    @pytest.mark.unit
    def test_word_overlap_ratio_empty(self) -> None:
        """Empty sets should have overlap ratio 0.0."""
        assert _word_overlap_ratio(set(), {"word"}) == 0.0
        assert _word_overlap_ratio({"word"}, set()) == 0.0
        assert _word_overlap_ratio(set(), set()) == 0.0

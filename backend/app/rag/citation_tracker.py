"""Citation tracking: maps agent claims back to source chunks."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

from app.rag.retriever import RetrievedChunk

logger = logging.getLogger(__name__)

_SIMILARITY_THRESHOLD = 0.3  # Minimum word overlap ratio to consider a match


@dataclass
class Citation:
    """A single citation linking a claim to a source chunk."""

    citation_id: int
    document_id: str
    title: str
    chunk_text: str
    relevance_score: float
    chunk_id: str = ""


@dataclass
class AnnotatedClaim:
    """A claim with its assigned citations."""

    claim_text: str
    citation_ids: list[int] = field(default_factory=list)
    is_supported: bool = True


@dataclass
class CitationReport:
    """The full citation analysis for an agent's output."""

    annotated_claims: list[AnnotatedClaim]
    bibliography: list[Citation]
    unsupported_claims: list[str]
    support_rate: float  # fraction of claims with at least one citation


class CitationTracker:
    """Maps every claim in agent output back to source chunks.

    Usage:
        tracker = CitationTracker(source_chunks)
        report = tracker.track(claims)
    """

    def __init__(self, source_chunks: list[RetrievedChunk]) -> None:
        self._chunks = source_chunks
        self._chunk_word_sets: list[set[str]] = [
            _extract_word_set(c.content) for c in source_chunks
        ]

    def track(self, claims: list[str]) -> CitationReport:
        """Assign citations to each claim and produce a full report."""
        bibliography: list[Citation] = []
        citation_map: dict[str, int] = {}  # chunk_id -> citation_id
        annotated: list[AnnotatedClaim] = []
        unsupported: list[str] = []

        for claim_text in claims:
            claim_words = _extract_word_set(claim_text)
            matched_citation_ids: list[int] = []

            for idx, chunk in enumerate(self._chunks):
                overlap = _word_overlap_ratio(claim_words, self._chunk_word_sets[idx])
                if overlap < _SIMILARITY_THRESHOLD:
                    continue

                # Assign or reuse citation ID for this chunk
                if chunk.chunk_id not in citation_map:
                    cit_id = len(bibliography) + 1
                    citation_map[chunk.chunk_id] = cit_id
                    bibliography.append(
                        Citation(
                            citation_id=cit_id,
                            document_id=chunk.document_id,
                            title=chunk.title,
                            chunk_text=chunk.content[:500],
                            relevance_score=chunk.relevance_score,
                            chunk_id=chunk.chunk_id,
                        )
                    )

                matched_citation_ids.append(citation_map[chunk.chunk_id])

            is_supported = len(matched_citation_ids) > 0
            annotated.append(
                AnnotatedClaim(
                    claim_text=claim_text,
                    citation_ids=matched_citation_ids,
                    is_supported=is_supported,
                )
            )

            if not is_supported:
                unsupported.append(claim_text)

        total = len(claims) if claims else 1
        support_rate = (total - len(unsupported)) / total

        report = CitationReport(
            annotated_claims=annotated,
            bibliography=bibliography,
            unsupported_claims=unsupported,
            support_rate=support_rate,
        )

        logger.info(
            "Citation tracking: %d claims, %d supported, %d unsupported (%.0f%% rate)",
            len(claims),
            len(claims) - len(unsupported),
            len(unsupported),
            support_rate * 100,
        )

        return report

    def format_bibliography(self, report: CitationReport) -> str:
        """Render the bibliography as a formatted text block."""
        if not report.bibliography:
            return "No sources cited."

        lines: list[str] = ["References", "----------"]
        for cit in report.bibliography:
            lines.append(
                f"[{cit.citation_id}] {cit.title} "
                f"(doc: {cit.document_id[:12]}..., "
                f"relevance: {cit.relevance_score:.2f})"
            )
            # Include a short excerpt
            excerpt = cit.chunk_text[:200].replace("\n", " ")
            lines.append(f'    "{excerpt}..."')
            lines.append("")

        return "\n".join(lines)

    def annotate_text(self, text: str, report: CitationReport) -> str:
        """Insert citation markers into the original text.

        For each annotated claim, appends [N] markers after the claim's
        occurrence in the text.
        """
        annotated_text = text
        for ac in report.annotated_claims:
            if not ac.citation_ids:
                continue
            markers = "".join(f"[{cid}]" for cid in ac.citation_ids)
            # Try to find the claim in the text and append markers
            claim_escaped = re.escape(ac.claim_text[:80])
            pattern = re.compile(f"({claim_escaped})", re.IGNORECASE)
            annotated_text = pattern.sub(rf"\1 {markers}", annotated_text, count=1)

        return annotated_text


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_WORD_PATTERN = re.compile(r"\b[a-zA-Z]{3,}\b")


def _extract_word_set(text: str) -> set[str]:
    """Extract a set of lowercase words (3+ chars) from text."""
    return {w.lower() for w in _WORD_PATTERN.findall(text)}


def _word_overlap_ratio(set_a: set[str], set_b: set[str]) -> float:
    """Ratio of overlapping words relative to the smaller set."""
    if not set_a or not set_b:
        return 0.0
    intersection = set_a & set_b
    smaller = min(len(set_a), len(set_b))
    return len(intersection) / smaller

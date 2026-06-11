"""Serialize an AnalysisResult into the exact JSON shape the frontend reads.

The backend dataclasses (Evidence -> supporting_sources, TechnologySignal with
0-1 strength / enum trend_direction) do not match what analyze/page.tsx expects
(source / source_url / relevance, strength 0-100, trend up|down|stable, etc.).
This module is the single mapping boundary.
"""

from __future__ import annotations

from app.agents.retrieval import EvidenceSource
from app.models import (
    AnalysisResult,
    Evidence,
    RiskItem,
    SourceCitation,
    TechnologySignal,
    TrendDirection,
)

_TREND_MAP = {
    TrendDirection.ACCELERATING: "up",
    TrendDirection.EMERGING: "up",
    TrendDirection.STEADY: "stable",
    TrendDirection.DECELERATING: "down",
}


def _bucket(score: float) -> str:
    if score >= 0.7:
        return "high"
    if score >= 0.45:
        return "medium"
    return "low"


def _primary(citations: list[SourceCitation]) -> SourceCitation | None:
    if not citations:
        return None
    return max(citations, key=lambda c: c.relevance_score)


def _serialize_evidence(e: Evidence) -> dict[str, object]:
    src = _primary(e.supporting_sources)
    return {
        "claim": e.claim,
        "confidence": e.confidence,
        "source": src.title if src else "Unknown",
        "source_url": src.url if src else None,
        "relevance": _bucket(src.relevance_score) if src else "low",
        "kind": src.kind if src else None,
        "citations": [
            {
                "title": c.title,
                "url": c.url,
                "kind": c.kind,
                "relevance": _bucket(c.relevance_score),
            }
            for c in e.supporting_sources
        ],
    }


def _horizon(years: float | None) -> str:
    if years is None:
        return "mid"
    if years < 2:
        return "near"
    if years <= 5:
        return "mid"
    return "far"


def _serialize_signal(s: TechnologySignal) -> dict[str, object]:
    category = (s.signal_type or "").replace("_", " ").strip().title() or "Signal"
    description = " ".join(s.supporting_data[:2]) if s.supporting_data else ""
    return {
        "name": s.technology or "Unknown",
        "category": category,
        "strength": max(0, min(100, round(s.signal_strength * 100))),
        "trend": _TREND_MAP.get(s.trend_direction, "stable"),
        "horizon": _horizon(s.commercialization_horizon_years),
        "readiness_level": s.readiness_level if s.readiness_level is not None else 5,
        "description": description,
    }


def _serialize_risk(r: RiskItem) -> dict[str, object]:
    return {
        "description": r.description,
        "category": r.category.value,
        "severity": r.severity.value,
        "likelihood": r.likelihood.value,
        "mitigation": r.mitigation,
    }


def serialize_analysis(
    result: AnalysisResult,
    pool: list[EvidenceSource],
    grounded: bool,
) -> dict[str, object]:
    web = sum(1 for s in pool if s.kind == "web")
    doc = sum(1 for s in pool if s.kind == "doc")
    return {
        "query": result.query,
        "recommendation": result.recommendation,
        "confidence_score": result.confidence_score,
        "executive_summary": result.executive_summary,
        "supporting_evidence": [_serialize_evidence(e) for e in result.supporting_evidence],
        "contrarian_evidence": [_serialize_evidence(e) for e in result.contrarian_evidence],
        "risks": [_serialize_risk(r) for r in result.risks],
        "key_assumptions": list(result.key_assumptions),
        "technology_signals": [_serialize_signal(s) for s in result.technology_signals],
        "grounded": grounded,
        "source_summary": {"web": web, "documents": doc, "total": len(pool)},
    }

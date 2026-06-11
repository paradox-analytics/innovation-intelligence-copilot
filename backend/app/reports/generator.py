from __future__ import annotations

from dataclasses import asdict

from app.models import AnalysisResult, Evidence, RiskItem, TechnologySignal


def to_markdown(result: AnalysisResult) -> str:
    sections: list[str] = []

    sections.append("# Innovation Intelligence Report\n")
    sections.append(f"**Query:** {result.query}\n")

    # Recommendation
    sections.append("## Recommendation\n")
    sections.append(f"**{result.recommendation}** (Confidence: {result.confidence_score}/100)\n")

    # Executive Summary
    sections.append("## Executive Summary\n")
    sections.append(f"{result.executive_summary}\n")

    # Supporting Evidence
    sections.append("## Supporting Evidence\n")
    if result.supporting_evidence:
        for ev in result.supporting_evidence:
            sections.append(f"- **{ev.claim}** (confidence: {ev.confidence:.0%})")
            for src in ev.supporting_sources:
                sections.append(f"  - Source: _{src.title}_ (relevance: {src.relevance_score:.2f})")
        sections.append("")
    else:
        sections.append("_No supporting evidence collected._\n")

    # Contrarian Evidence
    sections.append("## Contrarian Evidence\n")
    if result.contrarian_evidence:
        for ev in result.contrarian_evidence:
            sections.append(f"- **{ev.claim}** (confidence: {ev.confidence:.0%})")
            for src in ev.supporting_sources:
                sections.append(f"  - Source: _{src.title}_")
        sections.append("")
    else:
        sections.append("_No contrarian evidence collected._\n")

    # Strategic Risks
    sections.append("## Strategic Risks\n")
    if result.risks:
        for risk in result.risks:
            sections.append(
                f"- [{risk.severity.value.upper()}] [{risk.category.value}] **{risk.description}**"
            )
            sections.append(f"  - Likelihood: {risk.likelihood.value}")
            sections.append(f"  - Mitigation: {risk.mitigation}")
        sections.append("")
    else:
        sections.append("_No risks identified._\n")

    # Key Assumptions
    sections.append("## Key Assumptions\n")
    if result.key_assumptions:
        for assumption in result.key_assumptions:
            sections.append(f"- {assumption}")
        sections.append("")
    else:
        sections.append("_No key assumptions recorded._\n")

    # Technology Signals
    sections.append("## Technology Signals\n")
    if result.technology_signals:
        for signal in result.technology_signals:
            horizon = (
                f"{signal.commercialization_horizon_years:.1f} years"
                if signal.commercialization_horizon_years is not None
                else "unknown"
            )
            sections.append(
                f"- **{signal.technology}** [{signal.signal_type}] "
                f"strength: {signal.signal_strength:.0%}, "
                f"direction: {signal.trend_direction.value}, "
                f"horizon: {horizon}"
            )
            for dp in signal.supporting_data:
                sections.append(f"  - {dp}")
        sections.append("")
    else:
        sections.append("_No technology signals detected._\n")

    # Agent Performance
    if result.agent_traces:
        sections.append("## Agent Performance\n")
        sections.append("| Agent | Duration (ms) | Status |")
        sections.append("|-------|--------------|--------|")
        for trace in result.agent_traces:
            status = "error" if trace.error else "ok"
            sections.append(f"| {trace.agent_name} | {trace.duration_ms:.0f} | {status} |")
        sections.append("")

    return "\n".join(sections)


def to_json(result: AnalysisResult) -> dict[str, object]:
    """Convert AnalysisResult to a JSON-serializable dict for API responses."""

    def _serialize_evidence(items: list[Evidence]) -> list[dict[str, object]]:
        return [asdict(e) for e in items]

    def _serialize_risks(items: list[RiskItem]) -> list[dict[str, object]]:
        serialized: list[dict[str, object]] = []
        for r in items:
            d = asdict(r)
            d["category"] = r.category.value
            d["severity"] = r.severity.value
            d["likelihood"] = r.likelihood.value
            serialized.append(d)
        return serialized

    def _serialize_signals(items: list[TechnologySignal]) -> list[dict[str, object]]:
        serialized: list[dict[str, object]] = []
        for s in items:
            d = asdict(s)
            d["trend_direction"] = s.trend_direction.value
            serialized.append(d)
        return serialized

    return {
        "id": result.id,
        "query": result.query,
        "recommendation": result.recommendation,
        "confidence_score": result.confidence_score,
        "executive_summary": result.executive_summary,
        "supporting_evidence": _serialize_evidence(result.supporting_evidence),
        "contrarian_evidence": _serialize_evidence(result.contrarian_evidence),
        "risks": _serialize_risks(result.risks),
        "key_assumptions": result.key_assumptions,
        "technology_signals": _serialize_signals(result.technology_signals),
        "agent_traces": [asdict(t) for t in result.agent_traces],
    }

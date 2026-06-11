"""Tests for the plain-async analysis orchestrator (run_analysis)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agents.retrieval import EvidenceSource
from app.models import AnalysisResult, Evidence, SourceCitation

pytestmark = pytest.mark.unit


def _pool() -> list[EvidenceSource]:
    return [
        EvidenceSource(
            index=0,
            kind="web",
            title="Web Source",
            snippet="web finding",
            relevance="high",
            relevance_score=0.85,
            url="https://example.com/a",
        ),
        EvidenceSource(
            index=1,
            kind="doc",
            title="Doc Source",
            snippet="doc finding",
            relevance="medium",
            relevance_score=0.5,
            document_id="doc1",
        ),
    ]


def _configure(class_mock: MagicMock, name: str, result: dict) -> None:
    """Make ClassMock() return an instance whose .execute yields an AgentOutput."""
    inst = class_mock.return_value
    inst.name = name
    inst.execute = AsyncMock(return_value={"agent_name": name, "result": result, "trace": None})


_SUPPORT = {
    "supporting_evidence": [
        Evidence(
            claim="Strong adoption signal",
            supporting_sources=[
                SourceCitation(
                    document_id="",
                    title="Web Source",
                    chunk_text="web finding",
                    relevance_score=0.85,
                    url="https://example.com/a",
                    kind="web",
                )
            ],
            confidence=0.8,
        )
    ]
}
_SKEPTIC = {
    "contrarian_evidence": [Evidence(claim="Scale-up risk", supporting_sources=[], confidence=0.6)],
    "challenged_assumptions": ["Assumes pilot scales"],
}
_RISK = {"risks": []}
_TREND = {"technology_signals": []}


def _configure_executive(m_exec: MagicMock) -> None:
    """Mirror the real executive: build the result from the evidence it receives."""

    async def _execute(inputs):
        ctx = inputs["context"]
        return {
            "agent_name": "executive",
            "result": {
                "analysis_result": AnalysisResult(
                    query="q",
                    recommendation="TRIAL",
                    confidence_score=70,
                    executive_summary="ok",
                    supporting_evidence=ctx.get("supporting_evidence", []),
                    contrarian_evidence=ctx.get("contrarian_evidence", []),
                    risks=ctx.get("risks", []),
                    technology_signals=ctx.get("technology_signals", []),
                )
            },
            "trace": None,
        }

    m_exec.return_value.name = "executive"
    m_exec.return_value.execute = AsyncMock(side_effect=_execute)


@patch("app.agents.orchestrator.ExecutiveAgent")
@patch("app.agents.orchestrator.TrendAgent")
@patch("app.agents.orchestrator.RiskAgent")
@patch("app.agents.orchestrator.SkepticAgent")
@patch("app.agents.orchestrator.SupportAgent")
@patch("app.agents.orchestrator.retrieve_evidence", new_callable=AsyncMock)
async def test_run_analysis_happy_path(
    mock_retrieve, m_support, m_skeptic, m_risk, m_trend, m_exec
) -> None:
    from app.agents.orchestrator import run_analysis

    mock_retrieve.return_value = _pool()
    _configure(m_support, "support", _SUPPORT)
    _configure(m_skeptic, "skeptic", _SKEPTIC)
    _configure(m_risk, "risk", _RISK)
    _configure(m_trend, "trend", _TREND)
    _configure_executive(m_exec)

    on_event = AsyncMock()
    result, pool = await run_analysis("q", MagicMock(), on_event)

    assert result.recommendation == "TRIAL"
    assert result.confidence_score == 70
    assert len(result.supporting_evidence) == 1
    assert len(result.contrarian_evidence) == 1
    assert len(pool) == 2
    # research + 4 agents + executive all emit started/completed
    emitted = [c.args[0] for c in on_event.await_args_list]
    assert "agent_started" in emitted
    assert "agent_completed" in emitted


@patch("app.agents.orchestrator.ExecutiveAgent")
@patch("app.agents.orchestrator.TrendAgent")
@patch("app.agents.orchestrator.RiskAgent")
@patch("app.agents.orchestrator.SkepticAgent")
@patch("app.agents.orchestrator.SupportAgent")
@patch("app.agents.orchestrator.retrieve_evidence", new_callable=AsyncMock)
async def test_run_analysis_executive_failure_falls_back(
    mock_retrieve, m_support, m_skeptic, m_risk, m_trend, m_exec
) -> None:
    from app.agents.orchestrator import run_analysis

    mock_retrieve.return_value = _pool()
    _configure(m_support, "support", _SUPPORT)
    _configure(m_skeptic, "skeptic", _SKEPTIC)
    _configure(m_risk, "risk", _RISK)
    _configure(m_trend, "trend", _TREND)
    # Executive blows up -> orchestrator assembles a minimal fallback result.
    m_exec.return_value.name = "executive"
    m_exec.return_value.execute = AsyncMock(side_effect=RuntimeError("boom"))

    result, _ = await run_analysis("q", MagicMock())

    assert result.recommendation == "ASSESS"
    assert result.confidence_score == 0
    # Grounded evidence the agents gathered is still surfaced.
    assert len(result.supporting_evidence) == 1
    assert len(result.contrarian_evidence) == 1


@patch("app.agents.orchestrator.ExecutiveAgent")
@patch("app.agents.orchestrator.TrendAgent")
@patch("app.agents.orchestrator.RiskAgent")
@patch("app.agents.orchestrator.SkepticAgent")
@patch("app.agents.orchestrator.SupportAgent")
@patch("app.agents.orchestrator.retrieve_evidence", new_callable=AsyncMock)
async def test_run_analysis_agent_failure_degrades(
    mock_retrieve, m_support, m_skeptic, m_risk, m_trend, m_exec
) -> None:
    from app.agents.orchestrator import run_analysis

    mock_retrieve.return_value = _pool()
    # Support agent fails -> empty supporting evidence, pipeline still completes.
    m_support.return_value.name = "support"
    m_support.return_value.execute = AsyncMock(side_effect=RuntimeError("boom"))
    _configure(m_skeptic, "skeptic", _SKEPTIC)
    _configure(m_risk, "risk", _RISK)
    _configure(m_trend, "trend", _TREND)
    _configure_executive(m_exec)

    result, _ = await run_analysis("q", MagicMock())

    assert result.recommendation == "TRIAL"
    assert result.supporting_evidence == []
    assert len(result.contrarian_evidence) == 1

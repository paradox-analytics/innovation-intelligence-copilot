"""Tests for the agent orchestrator."""

from __future__ import annotations

from dataclasses import asdict
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agents.orchestrator import (
    OrchestratorState,
    build_graph,
    executive_node,
    parallel_analysis_node,
    research_node,
    run_analysis,
)
from app.models import (
    AgentTrace,
    AnalysisResult,
    Evidence,
    Likelihood,
    RiskCategory,
    RiskItem,
    Severity,
    SourceCitation,
    TechnologySignal,
    TrendDirection,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def base_state() -> OrchestratorState:
    """Minimal valid orchestrator state."""
    return OrchestratorState(
        query="What is the viability of quantum computing for drug discovery?",
        chunks=[
            {
                "document_id": "doc_001",
                "title": "Quantum Computing Overview",
                "content": "Quantum computing shows promise for molecular simulation.",
                "relevance_score": 0.85,
            }
        ],
        graph_signals=[],
        research_evidence=[],
        supporting_evidence=[],
        contrarian_evidence=[],
        challenged_assumptions=[],
        risks=[],
        technology_signals=[],
        analysis_result=None,
        agent_traces=[],
        error=None,
    )


@pytest.fixture
def sample_evidence() -> Evidence:
    return Evidence(
        claim="Quantum computers can simulate molecules",
        supporting_sources=[
            SourceCitation(
                document_id="doc_001",
                title="QC Overview",
                chunk_text="Quantum computing shows promise...",
                relevance_score=0.85,
            )
        ],
        confidence=0.8,
    )


@pytest.fixture
def sample_risk() -> RiskItem:
    return RiskItem(
        description="Quantum hardware is not yet scalable",
        category=RiskCategory.TECHNICAL,
        severity=Severity.HIGH,
        likelihood=Likelihood.LIKELY,
        mitigation="Partner with quantum cloud providers",
    )


@pytest.fixture
def sample_signal() -> TechnologySignal:
    return TechnologySignal(
        technology="Quantum Computing",
        signal_type="research_momentum",
        signal_strength=0.7,
        trend_direction=TrendDirection.ACCELERATING,
        commercialization_horizon_years=5.0,
        supporting_data=["100+ papers in 2024"],
    )


# ---------------------------------------------------------------------------
# Test: Graph construction
# ---------------------------------------------------------------------------


class TestBuildGraph:
    """Test that build_graph constructs the correct node/edge structure."""

    @pytest.mark.unit
    def test_graph_has_three_nodes(self) -> None:
        """The graph should have research, parallel_analysis, and executive nodes."""
        graph = build_graph()
        node_names = set(graph.nodes.keys())
        assert "research" in node_names
        assert "parallel_analysis" in node_names
        assert "executive" in node_names

    @pytest.mark.unit
    def test_graph_entry_point_is_research(self) -> None:
        """The entry point should be the research node."""
        graph = build_graph()
        # LangGraph stores entry point info; check via edges from __start__
        edges = graph.edges
        start_edges = [e for e in edges if e[0] == "__start__"]
        assert len(start_edges) == 1
        assert start_edges[0][1] == "research"

    @pytest.mark.unit
    def test_graph_edge_order(self) -> None:
        """Edges should flow: research -> parallel_analysis -> executive -> END."""
        graph = build_graph()
        edges = graph.edges
        edge_set = {(e[0], e[1]) for e in edges}
        assert ("research", "parallel_analysis") in edge_set
        assert ("parallel_analysis", "executive") in edge_set
        assert ("executive", "__end__") in edge_set


# ---------------------------------------------------------------------------
# Test: Research node
# ---------------------------------------------------------------------------


class TestResearchNode:
    """Test that the research node processes input correctly."""

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_research_node_produces_evidence(
        self, base_state: OrchestratorState
    ) -> None:
        """Research node should produce research_evidence in state."""
        mock_output = {
            "agent_name": "research",
            "result": {
                "evidence": [
                    Evidence(
                        claim="QC shows promise",
                        supporting_sources=[],
                        confidence=0.8,
                    )
                ]
            },
            "trace": AgentTrace(
                agent_name="research",
                started_at="2024-01-01T00:00:00",
                finished_at="2024-01-01T00:00:01",
                duration_ms=1000.0,
            ),
        }

        with patch(
            "app.agents.orchestrator.ResearchAgent"
        ) as MockAgent:
            instance = MockAgent.return_value
            instance.execute = AsyncMock(return_value=mock_output)

            new_state = await research_node(base_state)

        assert len(new_state["research_evidence"]) == 1
        assert len(new_state["agent_traces"]) == 1
        assert new_state["agent_traces"][0].agent_name == "research"

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_research_node_handles_empty_chunks(self) -> None:
        """Research node should handle empty chunks gracefully."""
        state = OrchestratorState(
            query="Test query for empty chunks",
            chunks=[],
            research_evidence=[],
            agent_traces=[],
        )

        mock_output = {
            "agent_name": "research",
            "result": {"evidence": [], "note": "No source documents available"},
            "trace": AgentTrace(
                agent_name="research",
                started_at="2024-01-01T00:00:00",
                finished_at="2024-01-01T00:00:01",
                duration_ms=500.0,
            ),
        }

        with patch(
            "app.agents.orchestrator.ResearchAgent"
        ) as MockAgent:
            instance = MockAgent.return_value
            instance.execute = AsyncMock(return_value=mock_output)

            new_state = await research_node(state)

        assert new_state["research_evidence"] == []


# ---------------------------------------------------------------------------
# Test: Parallel analysis handles agent failures
# ---------------------------------------------------------------------------


class TestParallelAnalysis:
    """Test that parallel analysis handles agent failures gracefully."""

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_parallel_analysis_handles_single_failure(
        self, base_state: OrchestratorState
    ) -> None:
        """If one agent fails, others should still produce results."""
        base_state["research_evidence"] = [
            {"claim": "Test claim", "confidence": 0.8}
        ]

        success_trace = AgentTrace(
            agent_name="support",
            started_at="2024-01-01T00:00:00",
            finished_at="2024-01-01T00:00:01",
            duration_ms=1000.0,
        )
        success_output = {
            "agent_name": "support",
            "result": {"supporting_evidence": []},
            "trace": success_trace,
        }

        error = RuntimeError("Agent failed")

        with (
            patch("app.agents.orchestrator.SupportAgent") as MockSupport,
            patch("app.agents.orchestrator.SkepticAgent") as MockSkeptic,
            patch("app.agents.orchestrator.RiskAgent") as MockRisk,
            patch("app.agents.orchestrator.TrendAgent") as MockTrend,
        ):
            MockSupport.return_value.execute = AsyncMock(return_value=success_output)
            MockSkeptic.return_value.execute = AsyncMock(side_effect=error)
            MockRisk.return_value.execute = AsyncMock(
                return_value={
                    "agent_name": "risk",
                    "result": {"risks": []},
                    "trace": AgentTrace(
                        agent_name="risk",
                        started_at="",
                        finished_at="",
                        duration_ms=0,
                    ),
                }
            )
            MockTrend.return_value.execute = AsyncMock(
                return_value={
                    "agent_name": "trend",
                    "result": {"technology_signals": []},
                    "trace": AgentTrace(
                        agent_name="trend",
                        started_at="",
                        finished_at="",
                        duration_ms=0,
                    ),
                }
            )

            new_state = await parallel_analysis_node(base_state)

        # Should have traces for all agents (including error trace for skeptic)
        assert len(new_state["agent_traces"]) >= 3
        error_traces = [
            t for t in new_state["agent_traces"] if t.error is not None
        ]
        assert len(error_traces) >= 1

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_parallel_analysis_all_succeed(
        self,
        base_state: OrchestratorState,
        sample_evidence: Evidence,
        sample_risk: RiskItem,
        sample_signal: TechnologySignal,
    ) -> None:
        """When all agents succeed, all result fields should be populated."""
        base_state["research_evidence"] = [
            {"claim": "Test", "confidence": 0.8}
        ]

        def make_output(name: str, result: dict[str, object]) -> dict[str, object]:
            return {
                "agent_name": name,
                "result": result,
                "trace": AgentTrace(
                    agent_name=name,
                    started_at="2024-01-01T00:00:00",
                    finished_at="2024-01-01T00:00:01",
                    duration_ms=1000.0,
                ),
            }

        with (
            patch("app.agents.orchestrator.SupportAgent") as MockSupport,
            patch("app.agents.orchestrator.SkepticAgent") as MockSkeptic,
            patch("app.agents.orchestrator.RiskAgent") as MockRisk,
            patch("app.agents.orchestrator.TrendAgent") as MockTrend,
        ):
            MockSupport.return_value.execute = AsyncMock(
                return_value=make_output(
                    "support", {"supporting_evidence": [sample_evidence]}
                )
            )
            MockSkeptic.return_value.execute = AsyncMock(
                return_value=make_output(
                    "skeptic",
                    {
                        "contrarian_evidence": [sample_evidence],
                        "challenged_assumptions": ["Assumption 1"],
                    },
                )
            )
            MockRisk.return_value.execute = AsyncMock(
                return_value=make_output("risk", {"risks": [sample_risk]})
            )
            MockTrend.return_value.execute = AsyncMock(
                return_value=make_output(
                    "trend", {"technology_signals": [sample_signal]}
                )
            )

            new_state = await parallel_analysis_node(base_state)

        assert len(new_state["supporting_evidence"]) == 1
        assert len(new_state["contrarian_evidence"]) == 1
        assert len(new_state["challenged_assumptions"]) == 1
        assert len(new_state["risks"]) == 1
        assert len(new_state["technology_signals"]) == 1


# ---------------------------------------------------------------------------
# Test: Executive node produces valid AnalysisResult
# ---------------------------------------------------------------------------


class TestExecutiveNode:
    """Test that the executive node produces a valid AnalysisResult."""

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_executive_produces_analysis_result(
        self,
        base_state: OrchestratorState,
        sample_evidence: Evidence,
        sample_risk: RiskItem,
        sample_signal: TechnologySignal,
    ) -> None:
        """Executive node should produce a fully populated AnalysisResult."""
        base_state["supporting_evidence"] = [sample_evidence]
        base_state["contrarian_evidence"] = [sample_evidence]
        base_state["challenged_assumptions"] = ["Assumption 1"]
        base_state["risks"] = [sample_risk]
        base_state["technology_signals"] = [sample_signal]

        analysis_result = AnalysisResult(
            query=base_state["query"],
            recommendation="ASSESS",
            confidence_score=65,
            executive_summary="Test summary",
            supporting_evidence=[sample_evidence],
            contrarian_evidence=[sample_evidence],
            risks=[sample_risk],
            key_assumptions=["Assumption 1"],
            technology_signals=[sample_signal],
        )

        mock_output = {
            "agent_name": "executive",
            "result": {"analysis_result": analysis_result},
            "trace": AgentTrace(
                agent_name="executive",
                started_at="2024-01-01T00:00:00",
                finished_at="2024-01-01T00:00:05",
                duration_ms=5000.0,
            ),
        }

        with patch(
            "app.agents.orchestrator.ExecutiveAgent"
        ) as MockExec:
            MockExec.return_value.execute = AsyncMock(return_value=mock_output)

            new_state = await executive_node(base_state)

        result = new_state["analysis_result"]
        assert result is not None
        assert result.recommendation == "ASSESS"
        assert result.confidence_score == 65
        assert result.executive_summary == "Test summary"
        assert len(result.agent_traces) >= 1

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_executive_handles_none_result(
        self, base_state: OrchestratorState
    ) -> None:
        """Executive node should handle None analysis_result gracefully."""
        mock_output = {
            "agent_name": "executive",
            "result": {"analysis_result": None},
            "trace": AgentTrace(
                agent_name="executive",
                started_at="2024-01-01T00:00:00",
                finished_at="2024-01-01T00:00:01",
                duration_ms=1000.0,
            ),
        }

        with patch(
            "app.agents.orchestrator.ExecutiveAgent"
        ) as MockExec:
            MockExec.return_value.execute = AsyncMock(return_value=mock_output)

            new_state = await executive_node(base_state)

        assert new_state["analysis_result"] is None

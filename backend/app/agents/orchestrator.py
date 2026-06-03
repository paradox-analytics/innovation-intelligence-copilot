from __future__ import annotations

import asyncio
import logging
from dataclasses import asdict
from typing import TypedDict

from langgraph.graph import END, StateGraph

from app.models import (
    AgentInput,
    AgentTrace,
    AnalysisResult,
    Evidence,
    RiskItem,
    TechnologySignal,
)

from .executive_agent import ExecutiveAgent
from .research_agent import ResearchAgent
from .risk_agent import RiskAgent
from .skeptic_agent import SkepticAgent
from .support_agent import SupportAgent
from .trend_agent import TrendAgent

logger = logging.getLogger(__name__)

_AGENT_TIMEOUT_SECONDS = 120


class OrchestratorState(TypedDict, total=False):
    query: str
    chunks: list[dict[str, object]]
    graph_signals: list[dict[str, object]]
    research_evidence: list[dict[str, object]]
    supporting_evidence: list[Evidence]
    contrarian_evidence: list[Evidence]
    challenged_assumptions: list[str]
    risks: list[RiskItem]
    technology_signals: list[TechnologySignal]
    analysis_result: AnalysisResult | None
    agent_traces: list[AgentTrace]
    error: str | None


async def _run_with_timeout(coro, timeout: int) -> dict[str, object]:
    return await asyncio.wait_for(coro, timeout=timeout)


async def research_node(state: OrchestratorState) -> OrchestratorState:
    agent = ResearchAgent()
    input_data = AgentInput(
        query=state["query"],
        context={"chunks": state.get("chunks", [])},
    )
    output = await _run_with_timeout(
        agent.execute(input_data),
        _AGENT_TIMEOUT_SECONDS,
    )

    evidence_raw = output["result"].get("evidence", [])
    # Convert Evidence dataclasses to dicts for downstream agents that receive them
    # as serialized context
    evidence_dicts: list[dict[str, object]] = [
        asdict(e) if isinstance(e, Evidence) else e for e in evidence_raw
    ]

    traces = list(state.get("agent_traces", []))
    traces.append(output["trace"])

    return {
        **state,
        "research_evidence": evidence_dicts,
        "agent_traces": traces,
    }


async def _parallel_analysis(state: OrchestratorState) -> OrchestratorState:
    """Runs support, skeptic, risk, and trend agents concurrently."""
    support = SupportAgent()
    skeptic = SkepticAgent()
    risk = RiskAgent()
    trend = TrendAgent()

    base_context: dict[str, object] = {
        "research_evidence": state.get("research_evidence", []),
        "graph_signals": state.get("graph_signals", []),
    }

    inputs = AgentInput(query=state["query"], context=base_context)
    timeout = _AGENT_TIMEOUT_SECONDS

    results = await asyncio.gather(
        _run_with_timeout(support.execute(inputs), timeout),
        _run_with_timeout(skeptic.execute(inputs), timeout),
        _run_with_timeout(risk.execute(inputs), timeout),
        _run_with_timeout(trend.execute(inputs), timeout),
        return_exceptions=True,
    )

    traces = list(state.get("agent_traces", []))
    supporting: list[Evidence] = []
    contrarian: list[Evidence] = []
    challenged: list[str] = []
    risks: list[RiskItem] = []
    signals: list[TechnologySignal] = []

    for i, result in enumerate(results):
        agent_name = ["support", "skeptic", "risk", "trend"][i]
        if isinstance(result, BaseException):
            logger.error("Agent %s failed: %s", agent_name, result)
            traces.append(
                AgentTrace(
                    agent_name=agent_name,
                    started_at="",
                    finished_at="",
                    duration_ms=0,
                    error=str(result),
                )
            )
            continue

        traces.append(result["trace"])

        if agent_name == "support":
            supporting = result["result"].get("supporting_evidence", [])
        elif agent_name == "skeptic":
            contrarian = result["result"].get("contrarian_evidence", [])
            challenged = result["result"].get("challenged_assumptions", [])
        elif agent_name == "risk":
            risks = result["result"].get("risks", [])
        elif agent_name == "trend":
            signals = result["result"].get("technology_signals", [])

    return {
        **state,
        "supporting_evidence": supporting,
        "contrarian_evidence": contrarian,
        "challenged_assumptions": challenged,
        "risks": risks,
        "technology_signals": signals,
        "agent_traces": traces,
    }


async def parallel_analysis_node(state: OrchestratorState) -> OrchestratorState:
    return await _parallel_analysis(state)


async def executive_node(state: OrchestratorState) -> OrchestratorState:
    agent = ExecutiveAgent()
    input_data = AgentInput(
        query=state["query"],
        context={
            "supporting_evidence": state.get("supporting_evidence", []),
            "contrarian_evidence": state.get("contrarian_evidence", []),
            "challenged_assumptions": state.get("challenged_assumptions", []),
            "risks": state.get("risks", []),
            "technology_signals": state.get("technology_signals", []),
        },
    )
    output = await _run_with_timeout(
        agent.execute(input_data),
        _AGENT_TIMEOUT_SECONDS,
    )

    traces = list(state.get("agent_traces", []))
    traces.append(output["trace"])

    analysis: AnalysisResult | None = output["result"].get("analysis_result")  # type: ignore[assignment]
    if analysis is not None:
        analysis.agent_traces = traces

    return {
        **state,
        "analysis_result": analysis,
        "agent_traces": traces,
    }


def build_graph() -> StateGraph:
    graph = StateGraph(OrchestratorState)

    graph.add_node("research", research_node)
    graph.add_node("parallel_analysis", parallel_analysis_node)
    graph.add_node("executive", executive_node)

    graph.set_entry_point("research")
    graph.add_edge("research", "parallel_analysis")
    graph.add_edge("parallel_analysis", "executive")
    graph.add_edge("executive", END)

    return graph


async def run_analysis(
    query: str,
    chunks: list[dict[str, object]] | None = None,
    graph_signals: list[dict[str, object]] | None = None,
) -> AnalysisResult:
    graph = build_graph()
    app = graph.compile()

    initial_state: OrchestratorState = {
        "query": query,
        "chunks": chunks or [],
        "graph_signals": graph_signals or [],
        "research_evidence": [],
        "supporting_evidence": [],
        "contrarian_evidence": [],
        "challenged_assumptions": [],
        "risks": [],
        "technology_signals": [],
        "analysis_result": None,
        "agent_traces": [],
        "error": None,
    }

    final_state = await app.ainvoke(initial_state)
    result: AnalysisResult | None = final_state.get("analysis_result")

    if result is None:
        raise RuntimeError("Analysis pipeline produced no result")

    return result

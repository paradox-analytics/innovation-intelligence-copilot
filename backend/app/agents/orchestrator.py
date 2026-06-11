"""Plain-async analysis orchestrator (no LangGraph).

Flow: retrieve evidence (web + docs) -> run support/skeptic/risk/trend
concurrently against the shared evidence pool -> executive synthesis.

Replaces the previous LangGraph StateGraph, which was the likely cause of the
production hang. Real source citations are threaded from retrieval all the way
through to the final AnalysisResult.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.retrieval import (
    EvidenceSource,
    format_pool_for_prompt,
    retrieve_evidence,
)
from app.core.config import settings
from app.models import (
    AgentInput,
    AnalysisResult,
    Evidence,
    RiskItem,
    TechnologySignal,
)

from .executive_agent import ExecutiveAgent
from .risk_agent import RiskAgent
from .skeptic_agent import SkepticAgent
from .support_agent import SupportAgent
from .trend_agent import TrendAgent

logger = logging.getLogger(__name__)

_AGENT_TIMEOUT_SECONDS = 120

# (event_type, data) -> awaitable. Default no-op so the orchestrator runs
# headless when no streaming consumer is attached.
EventHook = Callable[[str, dict[str, object]], Awaitable[None]]


async def _noop(_event: str, _data: dict[str, object]) -> None:
    return None


async def _run_agent(agent, inputs: AgentInput, on_event: EventHook):  # type: ignore[no-untyped-def]
    await on_event("agent_started", {"agent": agent.name})
    try:
        output = await asyncio.wait_for(agent.execute(inputs), timeout=_AGENT_TIMEOUT_SECONDS)
    except Exception as exc:
        logger.warning("agent %s failed: %s", agent.name, exc)
        await on_event("agent_completed", {"agent": agent.name})
        return agent.name, {}
    await on_event("agent_completed", {"agent": agent.name})
    return agent.name, output["result"]


async def run_analysis(
    query: str,
    db: AsyncSession,
    on_event: EventHook | None = None,
    pool: list[EvidenceSource] | None = None,
) -> tuple[AnalysisResult, list[EvidenceSource]]:
    """Run the grounded multi-agent analysis. Returns the result + evidence pool.

    Pass ``pool`` to reuse a cached evidence pool (deterministic re-runs) instead
    of retrieving fresh.
    """
    emit = on_event or _noop

    # 1. Retrieve evidence from web + documents (single shared pool), unless a
    #    cached pool was supplied.
    await emit("agent_started", {"agent": "research"})
    if pool is None:
        pool = await retrieve_evidence(query, db)
    await emit(
        "agent_completed",
        {"agent": "research", "partial_result": {"source_count": len(pool)}},
    )

    # Anchor every agent to the current date so "the next N years" and recency
    # judgements are grounded in today, not the model's training cutoff.
    today = datetime.now(UTC).date().isoformat()
    pool_text = f"Today's date is {today}.\n\n{format_pool_for_prompt(pool)}"
    context: dict[str, object] = {"evidence_pool": pool_text, "pool": pool}
    inputs = AgentInput(query=query, context=context)

    # 2. Run the four analytical agents concurrently against the shared pool.
    names_results = await asyncio.gather(
        _run_agent(SupportAgent(), inputs, emit),
        _run_agent(SkepticAgent(), inputs, emit),
        _run_agent(RiskAgent(), inputs, emit),
        _run_agent(TrendAgent(), inputs, emit),
    )
    by_agent = dict(names_results)

    supporting: list[Evidence] = by_agent.get("support", {}).get("supporting_evidence", [])
    contrarian: list[Evidence] = by_agent.get("skeptic", {}).get("contrarian_evidence", [])
    challenged: list[str] = by_agent.get("skeptic", {}).get("challenged_assumptions", [])
    risks: list[RiskItem] = by_agent.get("risk", {}).get("risks", [])
    signals: list[TechnologySignal] = by_agent.get("trend", {}).get("technology_signals", [])

    # 3. Executive synthesis.
    await emit("agent_started", {"agent": "executive"})
    exec_inputs = AgentInput(
        query=query,
        context={
            "supporting_evidence": supporting,
            "contrarian_evidence": contrarian,
            "challenged_assumptions": challenged,
            "risks": risks,
            "technology_signals": signals,
        },
    )
    try:
        exec_output = await asyncio.wait_for(
            ExecutiveAgent(model=settings.EXECUTIVE_MODEL).execute(exec_inputs),
            timeout=_AGENT_TIMEOUT_SECONDS,
        )
        result: AnalysisResult | None = exec_output["result"].get("analysis_result")  # type: ignore[assignment]
    except Exception as exc:
        logger.warning("executive agent failed: %s", exc)
        result = None
    await emit("agent_completed", {"agent": "executive"})

    if result is None:
        # Executive failed to produce a structured result — assemble a minimal one
        # so we still surface the grounded evidence the agents gathered.
        result = AnalysisResult(
            query=query,
            recommendation="ASSESS",
            confidence_score=0,
            executive_summary="",
            supporting_evidence=supporting,
            contrarian_evidence=contrarian,
            risks=risks,
            technology_signals=signals,
        )

    return result, pool

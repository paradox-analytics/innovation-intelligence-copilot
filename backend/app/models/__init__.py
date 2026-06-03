from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import TypedDict
from uuid import uuid4


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Likelihood(str, Enum):
    UNLIKELY = "unlikely"
    POSSIBLE = "possible"
    LIKELY = "likely"
    ALMOST_CERTAIN = "almost_certain"


class TrendDirection(str, Enum):
    ACCELERATING = "accelerating"
    STEADY = "steady"
    DECELERATING = "decelerating"
    EMERGING = "emerging"


class RiskCategory(str, Enum):
    STRATEGIC = "strategic"
    TECHNICAL = "technical"
    MARKET = "market"
    REGULATORY = "regulatory"


class AgentInput(TypedDict):
    query: str
    context: dict[str, object]


class AgentOutput(TypedDict):
    agent_name: str
    result: dict[str, object]
    trace: AgentTrace


@dataclass
class SourceCitation:
    document_id: str
    title: str
    chunk_text: str
    relevance_score: float
    page: int | None = None


@dataclass
class Evidence:
    claim: str
    supporting_sources: list[SourceCitation]
    confidence: float


@dataclass
class RiskItem:
    description: str
    category: RiskCategory
    severity: Severity
    likelihood: Likelihood
    mitigation: str


@dataclass
class TechnologySignal:
    technology: str
    signal_type: str
    signal_strength: float
    trend_direction: TrendDirection
    commercialization_horizon_years: float | None
    supporting_data: list[str]


@dataclass
class AgentTrace:
    agent_name: str
    started_at: str
    finished_at: str
    duration_ms: float
    input_tokens: int = 0
    output_tokens: int = 0
    error: str | None = None


@dataclass
class AnalysisResult:
    id: str = field(default_factory=lambda: uuid4().hex)
    query: str = ""
    recommendation: str = ""
    confidence_score: int = 0
    executive_summary: str = ""
    supporting_evidence: list[Evidence] = field(default_factory=list)
    contrarian_evidence: list[Evidence] = field(default_factory=list)
    risks: list[RiskItem] = field(default_factory=list)
    key_assumptions: list[str] = field(default_factory=list)
    technology_signals: list[TechnologySignal] = field(default_factory=list)
    agent_traces: list[AgentTrace] = field(default_factory=list)


@dataclass
class DocumentChunk:
    id: str
    document_id: str
    content: str
    embedding: list[float] | None = None
    metadata: dict[str, object] = field(default_factory=dict)
    chunk_index: int = 0


@dataclass
class GraphEntity:
    id: str
    name: str
    entity_type: str
    properties: dict[str, object] = field(default_factory=dict)


@dataclass
class GraphRelationship:
    source_id: str
    target_id: str
    relationship_type: str
    properties: dict[str, object] = field(default_factory=dict)

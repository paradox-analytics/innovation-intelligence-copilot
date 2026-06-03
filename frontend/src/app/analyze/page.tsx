"use client";

import { DashboardLayout } from "@/components/dashboard/layout";
import { ConfidenceGauge } from "@/components/reports/confidence-gauge";
import {
  EvidenceList,
  type EvidenceItem,
} from "@/components/reports/evidence-list";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Shield,
  Sparkles,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useState } from "react";

// --- Agent definitions ---

interface AgentDef {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const agents: AgentDef[] = [
  { id: "research", label: "Research", icon: <Search className="h-4 w-4" /> },
  {
    id: "support",
    label: "Support",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  {
    id: "skeptic",
    label: "Skeptic",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  { id: "risk", label: "Risk", icon: <Shield className="h-4 w-4" /> },
  {
    id: "trend",
    label: "Trend",
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    id: "executive",
    label: "Executive",
    icon: <Brain className="h-4 w-4" />,
  },
];

type AgentStatusValue = "pending" | "running" | "complete" | "error";

const statusBadge: Record<AgentStatusValue, { variant: BadgeVariant; label: string }> = {
  pending: { variant: "default", label: "Pending" },
  running: { variant: "blue", label: "Running" },
  complete: { variant: "emerald", label: "Complete" },
  error: { variant: "rose", label: "Error" },
};

const statusIcon: Record<AgentStatusValue, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5" />,
  running: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  complete: <CheckCircle2 className="h-3.5 w-3.5" />,
  error: <XCircle className="h-3.5 w-3.5" />,
};

// --- Mock data ---

const MOCK_SUPPORTING: EvidenceItem[] = [
  {
    id: "s1",
    claim:
      "Precision fermentation market projected to reach $36.3B by 2030 with 48.1% CAGR (Grand View Research, 2024).",
    source: "Grand View Research",
    sourceUrl: "https://www.grandviewresearch.com",
    relevance: "high",
    type: "supporting",
  },
  {
    id: "s2",
    claim:
      "BASF already operates fermentation assets for amino acids and vitamins, providing infrastructure advantage for specialty chemicals expansion.",
    source: "BASF Annual Report 2023",
    relevance: "high",
    type: "supporting",
  },
  {
    id: "s3",
    claim:
      "EU regulatory tailwinds (Green Deal Industrial Plan) provide subsidies for bio-based chemical production transition.",
    source: "European Commission",
    relevance: "medium",
    type: "supporting",
  },
];

const MOCK_CONTRARIAN: EvidenceItem[] = [
  {
    id: "c1",
    claim:
      "Scale-up from lab to commercial fermentation remains the primary failure mode -- 60% of bio-based startups fail at this stage.",
    source: "McKinsey Bio-Revolution Report",
    relevance: "high",
    type: "contrarian",
  },
  {
    id: "c2",
    claim:
      "Feedstock cost volatility (corn, sugarcane) could erode margins vs. established petrochemical routes during commodity cycles.",
    source: "IHS Markit",
    relevance: "medium",
    type: "contrarian",
  },
];

const MOCK_RISKS = [
  "Scale-up execution risk: transitioning from pilot to commercial-scale fermentation has a 60% failure rate in the industry.",
  "Feedstock price correlation with agricultural commodity markets introduces margin volatility.",
  "Competitive moat: Novozymes/DSM merger creates formidable competitor with deeper fermentation expertise.",
  "Regulatory timeline uncertainty: EU green chemistry certifications may take 18-36 months.",
  "Capital intensity: estimated $200-400M capex for dedicated microbial fermentation facility.",
];

const MOCK_ASSUMPTIONS = [
  "BASF can leverage existing fermentation infrastructure (amino acid/vitamin plants) for specialty chemicals.",
  "EU regulatory environment will continue favorable trajectory for bio-based chemicals through 2030.",
  "Customer willingness to pay 15-25% premium for bio-based specialty chemicals vs. petrochemical equivalents.",
  "Microbial strain engineering will achieve target yields within 24-month development timeline.",
  "No major IP infringement risks from Novozymes/DSM patent portfolio.",
];

interface MockAgentStatus {
  agent: string;
  status: AgentStatusValue;
}

const MOCK_AGENT_INITIAL: MockAgentStatus[] = agents.map((a) => ({
  agent: a.id,
  status: "pending" as AgentStatusValue,
}));

const MOCK_AGENT_RUNNING: MockAgentStatus[] = [
  { agent: "research", status: "complete" },
  { agent: "support", status: "complete" },
  { agent: "skeptic", status: "running" },
  { agent: "risk", status: "running" },
  { agent: "trend", status: "pending" },
  { agent: "executive", status: "pending" },
];

const MOCK_AGENT_DONE: MockAgentStatus[] = agents.map((a) => ({
  agent: a.id,
  status: "complete" as AgentStatusValue,
}));

// --- Page component ---

type AnalysisPhase = "idle" | "loading" | "complete";

export default function AnalyzePage() {
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<AnalysisPhase>("idle");
  const [agentStatuses, setAgentStatuses] =
    useState<MockAgentStatus[]>(MOCK_AGENT_INITIAL);

  const handleSubmit = () => {
    if (!question.trim()) return;

    setPhase("loading");
    setAgentStatuses(MOCK_AGENT_INITIAL);

    // Simulate agent progress
    setTimeout(() => {
      setAgentStatuses(MOCK_AGENT_RUNNING);
    }, 1200);

    setTimeout(() => {
      setAgentStatuses(MOCK_AGENT_DONE);
      setPhase("complete");
    }, 3500);
  };

  const handleReset = () => {
    setPhase("idle");
    setQuestion("");
    setAgentStatuses(MOCK_AGENT_INITIAL);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Strategic Analysis
          </h1>
          <p className="mt-1 text-text-secondary">
            Ask a strategic question and receive multi-agent AI intelligence.
          </p>
        </div>

        {/* Input area */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <label
                htmlFor="analysis-question"
                className="block text-sm font-medium text-text-secondary"
              >
                Strategic Question
              </label>
              <textarea
                id="analysis-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Should BASF invest in microbial fermentation for specialty chemicals?"
                rows={4}
                className={cn(
                  "w-full resize-none rounded-lg border border-border-default bg-bg-tertiary px-4 py-3 text-text-primary",
                  "placeholder:text-text-muted",
                  "focus:outline-none focus:ring-2 focus:ring-accent-blue focus:ring-offset-1 focus:ring-offset-bg-primary",
                  "transition-colors duration-200"
                )}
                disabled={phase === "loading"}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-muted">
                  Be specific about the company, technology, and strategic
                  decision.
                </p>
                <div className="flex gap-2">
                  {phase !== "idle" && (
                    <Button variant="ghost" onClick={handleReset}>
                      <RefreshCw className="h-4 w-4" />
                      Reset
                    </Button>
                  )}
                  <Button
                    onClick={handleSubmit}
                    disabled={!question.trim() || phase === "loading"}
                  >
                    {phase === "loading" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {phase === "loading" ? "Analyzing..." : "Analyze"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Agent progress */}
        {phase !== "idle" && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-5 w-5 text-accent-blue" />
                Agent Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {agents.map((agent) => {
                  const status =
                    agentStatuses.find((s) => s.agent === agent.id)?.status ||
                    "pending";
                  const badgeInfo = statusBadge[status];
                  return (
                    <div
                      key={agent.id}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-lg border p-3 transition-all",
                        status === "running"
                          ? "border-accent-blue/30 bg-accent-blue/5"
                          : status === "complete"
                          ? "border-accent-emerald/30 bg-accent-emerald/5"
                          : "border-border-default bg-bg-tertiary"
                      )}
                    >
                      <div className="flex items-center gap-1.5 text-text-primary">
                        {agent.icon}
                        <span className="text-xs font-medium">
                          {agent.label}
                        </span>
                      </div>
                      <Badge variant={badgeInfo.variant} className="gap-1">
                        {statusIcon[status]}
                        {badgeInfo.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading skeleton */}
        {phase === "loading" && (
          <div className="space-y-6 animate-fade-in">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="skeleton h-6 w-48" />
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-4 w-5/6" />
              </CardContent>
            </Card>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardContent className="p-6 space-y-3">
                  <div className="skeleton h-5 w-40" />
                  <div className="skeleton h-20 w-full" />
                  <div className="skeleton h-20 w-full" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 space-y-3">
                  <div className="skeleton h-5 w-40" />
                  <div className="skeleton h-20 w-full" />
                  <div className="skeleton h-20 w-full" />
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Results */}
        {phase === "complete" && (
          <div className="space-y-6 animate-fade-in">
            {/* Recommendation + Confidence */}
            <Card>
              <CardHeader>
                <CardTitle>Recommendation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                  <div className="flex-1">
                    <p className="text-base leading-relaxed text-text-primary">
                      <strong>Proceed with a staged investment</strong> in
                      microbial fermentation for specialty chemicals. Begin with
                      a $50-80M pilot facility leveraging existing amino acid
                      fermentation infrastructure, targeting 2-3 high-margin
                      specialty chemical categories where bio-based routes offer
                      clear performance or regulatory advantages. Full
                      commercial commitment ($200-400M) should be contingent on
                      pilot yields achieving 85%+ of theoretical maximums within
                      24 months.
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <ConfidenceGauge score={73} size={140} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Evidence columns */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardContent className="p-6">
                  <EvidenceList
                    title="Supporting Evidence"
                    items={MOCK_SUPPORTING}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <EvidenceList
                    title="Contrarian Evidence"
                    items={MOCK_CONTRARIAN}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Risks and Assumptions */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-5 w-5 text-accent-amber" />
                    Strategic Risks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {MOCK_RISKS.map((risk, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-text-secondary"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-amber" />
                        {risk}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="h-5 w-5 text-accent-violet" />
                    Key Assumptions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {MOCK_ASSUMPTIONS.map((assumption, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-text-secondary"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-violet" />
                        {assumption}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Executive Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Brain className="h-5 w-5 text-accent-blue" />
                  Executive Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm leading-relaxed text-text-secondary">
                  <p>
                    The microbial fermentation opportunity for specialty
                    chemicals represents a strategically attractive but
                    execution-dependent investment for BASF. Market fundamentals
                    are strong: the precision fermentation sector is growing at
                    48% CAGR, EU regulatory tailwinds favor bio-based routes,
                    and BASF possesses underutilized fermentation assets from its
                    amino acid and vitamin businesses.
                  </p>
                  <p>
                    However, the primary risk is scale-up execution. Industry
                    data shows a 60% failure rate at the lab-to-commercial
                    transition, and the Novozymes/DSM merger creates a
                    formidable competitor with deeper fermentation expertise. A
                    staged approach -- pilot first, then conditional full
                    investment -- de-risks the capital commitment while
                    preserving first-mover positioning in key specialty
                    categories.
                  </p>
                  <p>
                    We recommend proceeding with a $50-80M pilot facility,
                    targeting surfactants and polymer intermediates where
                    bio-based routes offer both performance advantages and
                    regulatory premium pricing. Full scale-up should be gated on
                    achieving 85%+ theoretical yield within 24 months.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

"use client";

import { DashboardLayout } from "@/components/dashboard/layout";
import { ConfidenceGauge } from "@/components/reports/confidence-gauge";
import {
  EvidenceList,
  type EvidenceItem,
} from "@/components/reports/evidence-list";
import { RiskMatrix, type RiskItem } from "@/components/reports/risk-matrix";
import { SignalCard, type SignalCardData } from "@/components/reports/signal-card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  ClipboardCopy,
  Download,
  FileText,
  History,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Send,
  Shield,
  Sparkles,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// --- Agent definitions ---

interface AgentDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  phase: "initial" | "parallel" | "final";
}

const agents: AgentDef[] = [
  { id: "research", label: "Research", icon: <Search className="h-4 w-4" />, phase: "initial" },
  { id: "support", label: "Support", icon: <CheckCircle2 className="h-4 w-4" />, phase: "parallel" },
  { id: "skeptic", label: "Skeptic", icon: <AlertTriangle className="h-4 w-4" />, phase: "parallel" },
  { id: "risk", label: "Risk", icon: <Shield className="h-4 w-4" />, phase: "parallel" },
  { id: "trend", label: "Trend", icon: <TrendingUp className="h-4 w-4" />, phase: "parallel" },
  { id: "executive", label: "Executive", icon: <Brain className="h-4 w-4" />, phase: "final" },
];

type AgentStatusValue = "waiting" | "running" | "complete" | "error";

const statusBadge: Record<AgentStatusValue, { variant: BadgeVariant; label: string }> = {
  waiting: { variant: "default", label: "Waiting" },
  running: { variant: "blue", label: "Running" },
  complete: { variant: "emerald", label: "Complete" },
  error: { variant: "rose", label: "Error" },
};

const statusIcon: Record<AgentStatusValue, React.ReactNode> = {
  waiting: <Clock className="h-3.5 w-3.5" />,
  running: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  complete: <CheckCircle2 className="h-3.5 w-3.5" />,
  error: <XCircle className="h-3.5 w-3.5" />,
};

// --- Mock data ---

const MOCK_SUPPORTING: EvidenceItem[] = [
  {
    id: "s1",
    claim: "Precision fermentation market projected to reach $36.3B by 2030 with 48.1% CAGR (Grand View Research, 2024).",
    source: "Grand View Research",
    sourceUrl: "https://www.grandviewresearch.com",
    relevance: "high",
    type: "supporting",
  },
  {
    id: "s2",
    claim: "BASF already operates fermentation assets for amino acids and vitamins, providing infrastructure advantage for specialty chemicals expansion.",
    source: "BASF Annual Report 2023",
    relevance: "high",
    type: "supporting",
  },
  {
    id: "s3",
    claim: "EU regulatory tailwinds (Green Deal Industrial Plan) provide subsidies for bio-based chemical production transition.",
    source: "European Commission",
    relevance: "medium",
    type: "supporting",
  },
];

const MOCK_CONTRARIAN: EvidenceItem[] = [
  {
    id: "c1",
    claim: "Scale-up from lab to commercial fermentation remains the primary failure mode -- 60% of bio-based startups fail at this stage.",
    source: "McKinsey Bio-Revolution Report",
    relevance: "high",
    type: "contrarian",
  },
  {
    id: "c2",
    claim: "Feedstock cost volatility (corn, sugarcane) could erode margins vs. established petrochemical routes during commodity cycles.",
    source: "IHS Markit",
    relevance: "medium",
    type: "contrarian",
  },
];

const MOCK_RISK_ITEMS: RiskItem[] = [
  { id: "r1", label: "Scale-up execution", likelihood: 4, severity: 4, description: "60% failure rate at lab-to-commercial transition" },
  { id: "r2", label: "Feedstock volatility", likelihood: 3, severity: 3, description: "Agricultural commodity cycles affect margins" },
  { id: "r3", label: "Competitor moat", likelihood: 3, severity: 4, description: "Novozymes/DSM merger creates formidable competitor" },
  { id: "r4", label: "Regulatory delays", likelihood: 2, severity: 3, description: "EU green chemistry certifications may take 18-36 months" },
  { id: "r5", label: "Capital intensity", likelihood: 4, severity: 3, description: "Estimated $200-400M capex for dedicated facility" },
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

const MOCK_SIGNALS: SignalCardData[] = [
  {
    id: "sig1",
    name: "Precision Fermentation",
    category: "Biotechnology",
    strength: 87,
    trend: "up",
    horizon: "near",
    description: "Rapid advancement in microbial strain engineering enabling cost-competitive production of specialty chemicals.",
    readinessLevel: 6,
  },
  {
    id: "sig2",
    name: "Synthetic Biology Platforms",
    category: "Biotechnology",
    strength: 72,
    trend: "up",
    horizon: "mid",
    description: "Programmable biology platforms reducing R&D timelines for novel chemical pathway development.",
    readinessLevel: 5,
  },
  {
    id: "sig3",
    name: "Bio-based Surfactants",
    category: "Materials",
    strength: 65,
    trend: "stable",
    horizon: "near",
    description: "Growing consumer and regulatory demand for bio-based alternatives to petrochemical surfactants.",
    readinessLevel: 7,
  },
  {
    id: "sig4",
    name: "Carbon Capture Fermentation",
    category: "Sustainability",
    strength: 41,
    trend: "up",
    horizon: "far",
    description: "Emerging methods to use captured CO2 as fermentation feedstock for chemical production.",
    readinessLevel: 3,
  },
];

const MOCK_FULL_REPORT = `# Strategic Analysis: BASF Investment in Microbial Fermentation for Specialty Chemicals

## Executive Summary

The microbial fermentation opportunity for specialty chemicals represents a strategically attractive but execution-dependent investment for BASF. Market fundamentals are strong: the precision fermentation sector is growing at 48% CAGR, EU regulatory tailwinds favor bio-based routes, and BASF possesses underutilized fermentation assets from its amino acid and vitamin businesses.

## Recommendation

**Proceed with a staged investment** in microbial fermentation for specialty chemicals. Begin with a $50-80M pilot facility leveraging existing amino acid fermentation infrastructure, targeting 2-3 high-margin specialty chemical categories where bio-based routes offer clear performance or regulatory advantages.

## Market Context

- Precision fermentation market: $36.3B by 2030 (48.1% CAGR)
- Bio-based chemicals market: $98.5B in 2023 (10.2% CAGR)
- EU Green Deal providing significant regulatory tailwinds

## Risk Assessment

The primary risk is scale-up execution. Industry data shows a 60% failure rate at the lab-to-commercial transition, and the Novozymes/DSM merger creates a formidable competitor with deeper fermentation expertise.

## Strategic Recommendation

A staged approach -- pilot first, then conditional full investment -- de-risks the capital commitment while preserving first-mover positioning in key specialty categories. Full scale-up should be gated on achieving 85%+ theoretical yield within 24 months.`;

interface MockAgentStatus {
  agent: string;
  status: AgentStatusValue;
  elapsed?: number;
}

interface SavedAnalysis {
  id: string;
  question: string;
  timestamp: string;
  confidence: number;
  bookmarked: boolean;
}

// --- Page component ---

type AnalysisPhase = "idle" | "loading" | "complete";

export default function AnalyzePage() {
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<AnalysisPhase>("idle");
  const [agentStatuses, setAgentStatuses] = useState<MockAgentStatus[]>(
    agents.map((a) => ({ agent: a.id, status: "waiting" as AgentStatusValue, elapsed: 0 }))
  );
  const [historySidebarOpen, setHistorySidebarOpen] = useState(false);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load saved analyses from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("iic-analyses");
      if (stored) {
        setSavedAnalyses(JSON.parse(stored) as SavedAnalysis[]);
      }
    } catch {
      // ignore
    }
  }, []);

  const saveToHistory = useCallback(
    (q: string, confidence: number) => {
      const entry: SavedAnalysis = {
        id: `a-${Date.now()}`,
        question: q,
        timestamp: new Date().toISOString(),
        confidence,
        bookmarked: false,
      };
      const updated = [entry, ...savedAnalyses].slice(0, 50);
      setSavedAnalyses(updated);
      try {
        localStorage.setItem("iic-analyses", JSON.stringify(updated));
      } catch {
        // ignore
      }
    },
    [savedAnalyses]
  );

  const toggleBookmark = useCallback(
    (id: string) => {
      const updated = savedAnalyses.map((a) =>
        a.id === id ? { ...a, bookmarked: !a.bookmarked } : a
      );
      setSavedAnalyses(updated);
      try {
        localStorage.setItem("iic-analyses", JSON.stringify(updated));
      } catch {
        // ignore
      }
    },
    [savedAnalyses]
  );

  const handleSubmit = () => {
    if (!question.trim()) return;
    setPhase("loading");

    const initialStatuses: MockAgentStatus[] = agents.map((a) => ({
      agent: a.id,
      status: "waiting" as AgentStatusValue,
      elapsed: 0,
    }));
    setAgentStatuses(initialStatuses);

    // Simulate agent pipeline: Research -> parallel -> Executive
    // Step 1: Research starts
    setTimeout(() => {
      setAgentStatuses((prev) =>
        prev.map((s) => (s.agent === "research" ? { ...s, status: "running" } : s))
      );
    }, 300);

    // Step 2: Research completes, parallel agents start
    setTimeout(() => {
      setAgentStatuses((prev) =>
        prev.map((s) => {
          if (s.agent === "research") return { ...s, status: "complete", elapsed: 1.2 };
          if (["support", "skeptic", "risk", "trend"].includes(s.agent))
            return { ...s, status: "running" };
          return s;
        })
      );
    }, 1500);

    // Step 3: Parallel agents complete staggered
    setTimeout(() => {
      setAgentStatuses((prev) =>
        prev.map((s) =>
          s.agent === "support" ? { ...s, status: "complete", elapsed: 0.8 } : s
        )
      );
    }, 2200);

    setTimeout(() => {
      setAgentStatuses((prev) =>
        prev.map((s) =>
          s.agent === "skeptic" ? { ...s, status: "complete", elapsed: 1.1 } : s
        )
      );
    }, 2600);

    setTimeout(() => {
      setAgentStatuses((prev) =>
        prev.map((s) =>
          s.agent === "risk" ? { ...s, status: "complete", elapsed: 1.4 } : s
        )
      );
    }, 2900);

    setTimeout(() => {
      setAgentStatuses((prev) =>
        prev.map((s) =>
          s.agent === "trend" ? { ...s, status: "complete", elapsed: 1.0 } : s
        )
      );
    }, 3000);

    // Step 4: Executive starts and completes
    setTimeout(() => {
      setAgentStatuses((prev) =>
        prev.map((s) =>
          s.agent === "executive" ? { ...s, status: "running" } : s
        )
      );
    }, 3200);

    setTimeout(() => {
      setAgentStatuses((prev) =>
        prev.map((s) =>
          s.agent === "executive" ? { ...s, status: "complete", elapsed: 0.9 } : s
        )
      );
      setPhase("complete");
      saveToHistory(question, 73);
    }, 4200);
  };

  const handleReset = () => {
    setPhase("idle");
    setQuestion("");
    setAgentStatuses(
      agents.map((a) => ({ agent: a.id, status: "waiting" as AgentStatusValue, elapsed: 0 }))
    );
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(MOCK_FULL_REPORT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const getRecommendationBadge = (confidence: number) => {
    if (confidence >= 70)
      return { label: "Proceed", variant: "emerald" as BadgeVariant };
    if (confidence >= 50)
      return { label: "Caution", variant: "amber" as BadgeVariant };
    return { label: "Avoid", variant: "rose" as BadgeVariant };
  };

  const recommendation = getRecommendationBadge(73);

  return (
    <DashboardLayout>
      <div className="flex h-full">
        {/* History Sidebar */}
        {historySidebarOpen && (
          <div className="w-72 shrink-0 border-r border-border-default bg-bg-secondary animate-fade-in overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border-default p-4">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <History className="h-4 w-4" />
                Query History
              </h3>
              <button
                onClick={() => setHistorySidebarOpen(false)}
                className="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary"
                aria-label="Close history"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1 p-2">
              {savedAnalyses.length === 0 ? (
                <p className="px-3 py-8 text-center text-xs text-text-muted">
                  No analyses yet. Submit a question to get started.
                </p>
              ) : (
                savedAnalyses.map((analysis) => (
                  <div
                    key={analysis.id}
                    className="group flex items-start gap-2 rounded-lg p-2.5 transition-colors hover:bg-bg-hover cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-text-primary line-clamp-2">
                        {analysis.question}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-text-muted">
                        <span>{new Date(analysis.timestamp).toLocaleDateString()}</span>
                        <span>{analysis.confidence}% confidence</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBookmark(analysis.id);
                      }}
                      className="shrink-0 rounded p-1 text-text-muted hover:text-accent-amber"
                      aria-label={analysis.bookmarked ? "Remove bookmark" : "Bookmark"}
                    >
                      {analysis.bookmarked ? (
                        <BookmarkCheck className="h-3.5 w-3.5 text-accent-amber" />
                      ) : (
                        <Bookmark className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100" />
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl space-y-8 p-6">
            {/* Page header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-text-primary">
                  Strategic Analysis
                </h1>
                <p className="mt-1 text-text-secondary">
                  Ask a strategic question and receive multi-agent AI intelligence.
                </p>
              </div>
              {!historySidebarOpen && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setHistorySidebarOpen(true)}
                >
                  <PanelLeftOpen className="h-4 w-4" />
                  History
                </Button>
              )}
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
                      Be specific about the company, technology, and strategic decision.
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

            {/* Agent Pipeline Visualization */}
            {phase !== "idle" && (
              <Card className="animate-fade-in overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-5 w-5 text-accent-blue" />
                    Agent Pipeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Flow visualization */}
                  <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
                    {/* Research (initial) */}
                    {(() => {
                      const researchStatus = agentStatuses.find((s) => s.agent === "research");
                      const status = researchStatus?.status || "waiting";
                      const badgeInfo = statusBadge[status];
                      return (
                        <div
                          className={cn(
                            "flex flex-col items-center gap-2 rounded-lg border p-3 min-w-[100px] transition-all duration-300",
                            status === "running" && "border-accent-blue/50 bg-accent-blue/5 shadow-lg shadow-accent-blue/10 animate-pulse-subtle",
                            status === "complete" && "border-accent-emerald/30 bg-accent-emerald/5",
                            status === "waiting" && "border-border-default bg-bg-tertiary"
                          )}
                        >
                          <div className="flex items-center gap-1.5 text-text-primary">
                            <Search className="h-4 w-4" />
                            <span className="text-xs font-medium">Research</span>
                          </div>
                          <Badge variant={badgeInfo.variant} className="gap-1">
                            {statusIcon[status]}
                            {badgeInfo.label}
                          </Badge>
                          {researchStatus?.elapsed ? (
                            <span className="text-[10px] text-text-muted">
                              {researchStatus.elapsed.toFixed(1)}s
                            </span>
                          ) : null}
                        </div>
                      );
                    })()}

                    {/* Arrow */}
                    <ChevronRight className="h-5 w-5 shrink-0 text-text-muted" />

                    {/* Parallel agents group */}
                    <div className="flex gap-2 rounded-lg border border-dashed border-border-subtle p-2">
                      {agents
                        .filter((a) => a.phase === "parallel")
                        .map((agent) => {
                          const agentStatus = agentStatuses.find(
                            (s) => s.agent === agent.id
                          );
                          const status = agentStatus?.status || "waiting";
                          const badgeInfo = statusBadge[status];
                          return (
                            <div
                              key={agent.id}
                              className={cn(
                                "flex flex-col items-center gap-2 rounded-lg border p-3 min-w-[90px] transition-all duration-300",
                                status === "running" && "border-accent-blue/50 bg-accent-blue/5 shadow-lg shadow-accent-blue/10 animate-pulse-subtle",
                                status === "complete" && "border-accent-emerald/30 bg-accent-emerald/5",
                                status === "waiting" && "border-border-default bg-bg-tertiary"
                              )}
                            >
                              <div className="flex items-center gap-1.5 text-text-primary">
                                {agent.icon}
                                <span className="text-xs font-medium">
                                  {agent.label}
                                </span>
                              </div>
                              <Badge variant={badgeInfo.variant} className="gap-1 text-[10px]">
                                {statusIcon[status]}
                                {badgeInfo.label}
                              </Badge>
                              {agentStatus?.elapsed ? (
                                <span className="text-[10px] text-text-muted">
                                  {agentStatus.elapsed.toFixed(1)}s
                                </span>
                              ) : null}
                            </div>
                          );
                        })}
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="h-5 w-5 shrink-0 text-text-muted" />

                    {/* Executive (final) */}
                    {(() => {
                      const execStatus = agentStatuses.find((s) => s.agent === "executive");
                      const status = execStatus?.status || "waiting";
                      const badgeInfo = statusBadge[status];
                      return (
                        <div
                          className={cn(
                            "flex flex-col items-center gap-2 rounded-lg border p-3 min-w-[100px] transition-all duration-300",
                            status === "running" && "border-accent-blue/50 bg-accent-blue/5 shadow-lg shadow-accent-blue/10 animate-pulse-subtle",
                            status === "complete" && "border-accent-emerald/30 bg-accent-emerald/5",
                            status === "waiting" && "border-border-default bg-bg-tertiary"
                          )}
                        >
                          <div className="flex items-center gap-1.5 text-text-primary">
                            <Brain className="h-4 w-4" />
                            <span className="text-xs font-medium">Executive</span>
                          </div>
                          <Badge variant={badgeInfo.variant} className="gap-1">
                            {statusIcon[status]}
                            {badgeInfo.label}
                          </Badge>
                          {execStatus?.elapsed ? (
                            <span className="text-[10px] text-text-muted">
                              {execStatus.elapsed.toFixed(1)}s
                            </span>
                          ) : null}
                        </div>
                      );
                    })()}
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
              </div>
            )}

            {/* Results with Tabs */}
            {phase === "complete" && (
              <div className="space-y-6 animate-fade-in">
                <Tabs defaultValue="overview">
                  <TabsList className="w-fit">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="evidence">Evidence</TabsTrigger>
                    <TabsTrigger value="risks">Risks</TabsTrigger>
                    <TabsTrigger value="signals">Signals</TabsTrigger>
                    <TabsTrigger value="report">Full Report</TabsTrigger>
                  </TabsList>

                  {/* Overview Tab */}
                  <TabsContent value="overview" className="mt-6 space-y-6">
                    {/* Recommendation + Confidence */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>Recommendation</CardTitle>
                          <Badge variant={recommendation.variant} className="text-sm px-3 py-1">
                            {recommendation.label}
                          </Badge>
                        </div>
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
                              clear performance or regulatory advantages.
                            </p>
                          </div>
                          <div className="flex-shrink-0">
                            <ConfidenceGauge score={73} size={140} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

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
                            The microbial fermentation opportunity for specialty chemicals
                            represents a strategically attractive but execution-dependent
                            investment for BASF. Market fundamentals are strong: the
                            precision fermentation sector is growing at 48% CAGR, EU
                            regulatory tailwinds favor bio-based routes, and BASF possesses
                            underutilized fermentation assets from its amino acid and
                            vitamin businesses.
                          </p>
                          <p>
                            However, the primary risk is scale-up execution. A staged
                            approach -- pilot first, then conditional full investment --
                            de-risks the capital commitment while preserving first-mover
                            positioning in key specialty categories.
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Key Assumptions */}
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
                  </TabsContent>

                  {/* Evidence Tab */}
                  <TabsContent value="evidence" className="mt-6">
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
                  </TabsContent>

                  {/* Risks Tab */}
                  <TabsContent value="risks" className="mt-6 space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <AlertTriangle className="h-5 w-5 text-accent-amber" />
                          Risk Matrix
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <RiskMatrix items={MOCK_RISK_ITEMS} />
                      </CardContent>
                    </Card>

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
                  </TabsContent>

                  {/* Signals Tab */}
                  <TabsContent value="signals" className="mt-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {MOCK_SIGNALS.map((signal) => (
                        <SignalCard key={signal.id} signal={signal} />
                      ))}
                    </div>
                  </TabsContent>

                  {/* Full Report Tab */}
                  <TabsContent value="report" className="mt-6">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <FileText className="h-5 w-5 text-accent-blue" />
                            Full Report
                          </CardTitle>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCopyReport}
                            >
                              <ClipboardCopy className="h-4 w-4" />
                              {copied ? "Copied!" : "Copy"}
                            </Button>
                            <Button variant="outline" size="sm">
                              <Download className="h-4 w-4" />
                              Export PDF
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="prose prose-invert max-w-none rounded-lg bg-bg-tertiary p-6">
                          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary font-sans">
                            {MOCK_FULL_REPORT}
                          </pre>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

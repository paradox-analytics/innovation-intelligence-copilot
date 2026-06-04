"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/layout";
import { apiClient, type AnalysisResultResponse } from "@/lib/api";
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
import { useAnalysis } from "@/hooks/use-analysis";
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
import { useCallback, useEffect, useState } from "react";

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

interface SavedAnalysis {
  id: string;
  question: string;
  timestamp: string;
  confidence: number | null;
  bookmarked: boolean;
}

// --- Helpers to extract typed data from the result dict ---

function extractEvidenceItems(
  items: unknown,
  type: "supporting" | "contrarian"
): EvidenceItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((item: Record<string, unknown>, i: number) => ({
    id: String(item.id ?? `${type}-${i}`),
    claim: String(item.claim ?? item.text ?? ""),
    source: String(item.source ?? "Unknown"),
    sourceUrl: item.source_url ? String(item.source_url) : undefined,
    relevance: (item.relevance as "high" | "medium" | "low") ?? "medium",
    type,
  }));
}

function extractRiskItems(items: unknown): RiskItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((item: Record<string, unknown>, i: number) => ({
    id: String(item.id ?? `risk-${i}`),
    label: String(item.label ?? item.name ?? `Risk ${i + 1}`),
    likelihood: (Number(item.likelihood) || 3) as 1 | 2 | 3 | 4 | 5,
    severity: (Number(item.severity) || 3) as 1 | 2 | 3 | 4 | 5,
    description: item.description ? String(item.description) : undefined,
  }));
}

interface StructuredRisk {
  description: string;
  category: string;
  severity: string;
  likelihood: string;
  mitigation: string;
}

function extractStrings(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) =>
    typeof item === "object" && item !== null && "description" in item
      ? String((item as Record<string, unknown>).description)
      : String(item)
  );
}

function extractStructuredRisks(items: unknown): StructuredRisk[] {
  if (!Array.isArray(items)) return [];
  return items.map((item: Record<string, unknown>) => ({
    description: String(item.description ?? ""),
    category: String(item.category ?? "general"),
    severity: String(item.severity ?? "medium"),
    likelihood: String(item.likelihood ?? "possible"),
    mitigation: String(item.mitigation ?? ""),
  }));
}

function severityColor(severity: string): BadgeVariant {
  switch (severity.toLowerCase()) {
    case "critical": return "rose";
    case "high": return "amber";
    case "medium": return "default";
    case "low": return "emerald";
    default: return "default";
  }
}

function extractSignals(items: unknown): SignalCardData[] {
  if (!Array.isArray(items)) return [];
  return items.map((item: Record<string, unknown>, i: number) => ({
    id: String(item.id ?? `sig-${i}`),
    name: String(item.name ?? item.technology ?? ""),
    category: String(item.category ?? item.signal_type ?? "Unknown"),
    strength: Number(item.strength ?? item.signal_strength ?? 50),
    trend: (item.trend as "up" | "down" | "stable") ?? "stable",
    horizon: (item.horizon as "near" | "mid" | "far") ?? "mid",
    description: String(item.description ?? ""),
    readinessLevel: Number(item.readinessLevel ?? item.readiness_level ?? 5),
  }));
}

// --- Page component ---

export default function AnalyzePage() {
  return (
    <Suspense fallback={<DashboardLayout><div className="p-8 text-text-muted">Loading...</div></DashboardLayout>}>
      <AnalyzePageContent />
    </Suspense>
  );
}

function AnalyzePageContent() {
  const searchParams = useSearchParams();
  const [question, setQuestion] = useState("");
  const [historySidebarOpen, setHistorySidebarOpen] = useState(false);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [copied, setCopied] = useState(false);
  const [loadedResult, setLoadedResult] = useState<AnalysisResultResponse | null>(null);

  const { result: liveResult, status, error, agentProgress, submit, reset: resetAnalysis } = useAnalysis();

  const result = loadedResult ?? liveResult;
  const isLoading = status === "submitting" || status === "streaming" || status === "polling";
  const isComplete = (status === "complete" && liveResult !== null) || loadedResult !== null;
  const isIdle = status === "idle" && loadedResult === null;

  const reset = useCallback(() => {
    setLoadedResult(null);
    resetAnalysis();
    setQuestion("");
    window.history.replaceState(null, "", "/analyze");
  }, [resetAnalysis]);

  // Load previous analysis from URL ?id= parameter
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) return;

    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.getAnalysis(id);
        if (!cancelled && data.status === "COMPLETED") {
          setLoadedResult(data);
          setQuestion(data.query);
        }
      } catch {
        // Analysis not found or failed — ignore, show empty form
      }
    })();
    return () => { cancelled = true; };
  }, [searchParams]);

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

  // Save to history when an analysis completes
  useEffect(() => {
    if (isComplete && result) {
      const entry: SavedAnalysis = {
        id: result.id,
        question: result.query,
        timestamp: result.created_at,
        confidence: result.confidence_score,
        bookmarked: false,
      };
      setSavedAnalyses((prev) => {
        // avoid duplicates
        const exists = prev.some((a) => a.id === entry.id);
        if (exists) return prev;
        const updated = [entry, ...prev].slice(0, 50);
        try {
          localStorage.setItem("iic-analyses", JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });

      // Cache the full result for the reports page
      if (result.result) {
        try {
          localStorage.setItem(
            `iic-analysis-${result.id}`,
            JSON.stringify(result.result)
          );
        } catch {
          // ignore (quota exceeded)
        }
      }
    }
  }, [isComplete, result]);

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

  const handleSubmit = async () => {
    if (!question.trim()) return;
    await submit({ query: question });
  };

  const handleReset = () => {
    reset();
  };

  // Extract data from the analysis result
  const analysisResult = result?.result as Record<string, unknown> | null;
  const confidenceScore = result?.confidence_score ?? null;

  const recommendation = analysisResult?.recommendation
    ? String(analysisResult.recommendation)
    : null;
  const executiveSummary = analysisResult?.executive_summary
    ? String(analysisResult.executive_summary)
    : null;

  const supportingEvidence = extractEvidenceItems(
    analysisResult?.supporting_evidence,
    "supporting"
  );
  const contrarianEvidence = extractEvidenceItems(
    analysisResult?.contrarian_evidence,
    "contrarian"
  );
  const riskItems = extractRiskItems(analysisResult?.risk_items);
  const structuredRisks = extractStructuredRisks(analysisResult?.risks ?? analysisResult?.strategic_risks);
  const risks = structuredRisks.map((r) => r.description);
  const assumptions = extractStrings(analysisResult?.key_assumptions);
  const signals = extractSignals(analysisResult?.technology_signals);

  // Build a full report text from sections
  const fullReportText = [
    `# Strategic Analysis: ${result?.query ?? question}`,
    "",
    executiveSummary ? `## Executive Summary\n\n${executiveSummary}` : "",
    recommendation ? `## Recommendation\n\n${recommendation}` : "",
    risks.length > 0
      ? `## Risk Assessment\n\n${risks.map((r) => `- ${r}`).join("\n")}`
      : "",
    assumptions.length > 0
      ? `## Key Assumptions\n\n${assumptions.map((a) => `- ${a}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(fullReportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const getRecommendationBadge = (confidence: number | null) => {
    if (confidence === null) return { label: "Pending", variant: "default" as BadgeVariant };
    if (confidence >= 0.7 || confidence >= 70)
      return { label: "Proceed", variant: "emerald" as BadgeVariant };
    if (confidence >= 0.5 || confidence >= 50)
      return { label: "Caution", variant: "amber" as BadgeVariant };
    return { label: "Avoid", variant: "rose" as BadgeVariant };
  };

  const recBadge = getRecommendationBadge(confidenceScore);
  // Normalize score to 0-100 for gauge display
  const gaugeScore =
    confidenceScore !== null
      ? confidenceScore <= 1
        ? Math.round(confidenceScore * 100)
        : Math.round(confidenceScore)
      : 0;

  // Map agent progress to display status
  const getAgentStatus = (agentId: string): AgentStatusValue => {
    const progress = agentProgress.find((ap) => ap.agent === agentId);
    if (!progress) return "waiting";
    return progress.status;
  };

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
                        {analysis.confidence !== null && (
                          <span>
                            {analysis.confidence <= 1
                              ? `${Math.round(analysis.confidence * 100)}%`
                              : `${Math.round(analysis.confidence)}%`}{" "}
                            confidence
                          </span>
                        )}
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
                    disabled={isLoading}
                  />
                  {error && (
                    <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/5 p-3 text-sm text-accent-rose">
                      {error}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-text-muted">
                      Be specific about the company, technology, and strategic decision.
                    </p>
                    <div className="flex gap-2">
                      {!isIdle && (
                        <Button variant="ghost" onClick={handleReset}>
                          <RefreshCw className="h-4 w-4" />
                          Reset
                        </Button>
                      )}
                      <Button
                        onClick={handleSubmit}
                        disabled={!question.trim() || isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        {isLoading ? "Analyzing..." : "Analyze"}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Agent Pipeline Visualization */}
            {!isIdle && (
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
                      const agentStatus = getAgentStatus("research");
                      const badgeInfo = statusBadge[agentStatus];
                      return (
                        <div
                          className={cn(
                            "flex flex-col items-center gap-2 rounded-lg border p-3 min-w-[100px] transition-all duration-300",
                            agentStatus === "running" && "border-accent-blue/50 bg-accent-blue/5 shadow-lg shadow-accent-blue/10 animate-pulse-subtle",
                            agentStatus === "complete" && "border-accent-emerald/30 bg-accent-emerald/5",
                            agentStatus === "waiting" && "border-border-default bg-bg-tertiary"
                          )}
                        >
                          <div className="flex items-center gap-1.5 text-text-primary">
                            <Search className="h-4 w-4" />
                            <span className="text-xs font-medium">Research</span>
                          </div>
                          <Badge variant={badgeInfo.variant} className="gap-1">
                            {statusIcon[agentStatus]}
                            {badgeInfo.label}
                          </Badge>
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
                          const agentStatus = getAgentStatus(agent.id);
                          const badgeInfo = statusBadge[agentStatus];
                          return (
                            <div
                              key={agent.id}
                              className={cn(
                                "flex flex-col items-center gap-2 rounded-lg border p-3 min-w-[90px] transition-all duration-300",
                                agentStatus === "running" && "border-accent-blue/50 bg-accent-blue/5 shadow-lg shadow-accent-blue/10 animate-pulse-subtle",
                                agentStatus === "complete" && "border-accent-emerald/30 bg-accent-emerald/5",
                                agentStatus === "waiting" && "border-border-default bg-bg-tertiary"
                              )}
                            >
                              <div className="flex items-center gap-1.5 text-text-primary">
                                {agent.icon}
                                <span className="text-xs font-medium">
                                  {agent.label}
                                </span>
                              </div>
                              <Badge variant={badgeInfo.variant} className="gap-1 text-[10px]">
                                {statusIcon[agentStatus]}
                                {badgeInfo.label}
                              </Badge>
                            </div>
                          );
                        })}
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="h-5 w-5 shrink-0 text-text-muted" />

                    {/* Executive (final) */}
                    {(() => {
                      const agentStatus = getAgentStatus("executive");
                      const badgeInfo = statusBadge[agentStatus];
                      return (
                        <div
                          className={cn(
                            "flex flex-col items-center gap-2 rounded-lg border p-3 min-w-[100px] transition-all duration-300",
                            agentStatus === "running" && "border-accent-blue/50 bg-accent-blue/5 shadow-lg shadow-accent-blue/10 animate-pulse-subtle",
                            agentStatus === "complete" && "border-accent-emerald/30 bg-accent-emerald/5",
                            agentStatus === "waiting" && "border-border-default bg-bg-tertiary"
                          )}
                        >
                          <div className="flex items-center gap-1.5 text-text-primary">
                            <Brain className="h-4 w-4" />
                            <span className="text-xs font-medium">Executive</span>
                          </div>
                          <Badge variant={badgeInfo.variant} className="gap-1">
                            {statusIcon[agentStatus]}
                            {badgeInfo.label}
                          </Badge>
                        </div>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Loading skeleton */}
            {isLoading && (
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

            {/* Error state */}
            {status === "error" && error && !isLoading && (
              <Card className="animate-fade-in border-accent-rose/30">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-accent-rose shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        Analysis Failed
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">{error}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={handleSubmit}
                      >
                        <RefreshCw className="h-4 w-4" />
                        Retry
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Results with Tabs */}
            {isComplete && (
              <div className="space-y-6 animate-fade-in">
                <Tabs defaultValue="overview">
                  <TabsList className="w-fit">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    {(supportingEvidence.length > 0 || contrarianEvidence.length > 0) && (
                      <TabsTrigger value="evidence">Evidence</TabsTrigger>
                    )}
                    {(risks.length > 0 || riskItems.length > 0) && (
                      <TabsTrigger value="risks">Risks</TabsTrigger>
                    )}
                    {signals.length > 0 && (
                      <TabsTrigger value="signals">Signals</TabsTrigger>
                    )}
                    <TabsTrigger value="report">Full Report</TabsTrigger>
                  </TabsList>

                  {/* Overview Tab */}
                  <TabsContent value="overview" className="mt-6 space-y-6">
                    {/* Recommendation + Confidence */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>Recommendation</CardTitle>
                          <Badge variant={recBadge.variant} className="text-sm px-3 py-1">
                            {recBadge.label}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                          <div className="flex-1">
                            {recommendation ? (
                              <p className="text-base leading-relaxed text-text-primary">
                                {recommendation}
                              </p>
                            ) : (
                              <p className="text-sm text-text-muted italic">
                                No recommendation available.
                              </p>
                            )}
                          </div>
                          {confidenceScore !== null && (
                            <div className="flex-shrink-0">
                              <ConfidenceGauge score={gaugeScore} size={140} />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Analysis Indicators */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-lg border border-border-primary bg-bg-secondary p-3 text-center">
                        <div className="text-2xl font-bold text-accent-emerald">{supportingEvidence.length}</div>
                        <div className="text-xs text-text-tertiary">Supporting</div>
                      </div>
                      <div className="rounded-lg border border-border-primary bg-bg-secondary p-3 text-center">
                        <div className="text-2xl font-bold text-accent-rose">{contrarianEvidence.length}</div>
                        <div className="text-xs text-text-tertiary">Contrarian</div>
                      </div>
                      <div className="rounded-lg border border-border-primary bg-bg-secondary p-3 text-center">
                        <div className="text-2xl font-bold text-accent-amber">{structuredRisks.length}</div>
                        <div className="text-xs text-text-tertiary">Risks</div>
                      </div>
                      <div className="rounded-lg border border-border-primary bg-bg-secondary p-3 text-center">
                        <div className="text-2xl font-bold text-accent-blue">{assumptions.length}</div>
                        <div className="text-xs text-text-tertiary">Assumptions</div>
                      </div>
                    </div>

                    {/* Risk Severity Breakdown */}
                    {structuredRisks.length > 0 && (
                      <Card>
                        <CardContent className="p-4">
                          <div className="mb-2 text-xs font-medium text-text-tertiary uppercase tracking-wider">Risk Severity Distribution</div>
                          <div className="flex gap-2">
                            {(["critical", "high", "medium", "low"] as const).map((level) => {
                              const count = structuredRisks.filter((r) => r.severity.toLowerCase() === level).length;
                              if (count === 0) return null;
                              const total = structuredRisks.length;
                              const pct = Math.round((count / total) * 100);
                              const colors: Record<string, string> = {
                                critical: "bg-red-500",
                                high: "bg-amber-500",
                                medium: "bg-yellow-500",
                                low: "bg-emerald-500",
                              };
                              return (
                                <div key={level} className="flex-1">
                                  <div className="mb-1 flex items-center justify-between text-xs">
                                    <span className="capitalize text-text-secondary">{level}</span>
                                    <span className="text-text-tertiary">{count}</span>
                                  </div>
                                  <div className="h-2 w-full rounded-full bg-bg-tertiary">
                                    <div
                                      className={cn("h-2 rounded-full", colors[level])}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Evidence Balance */}
                    {(supportingEvidence.length > 0 || contrarianEvidence.length > 0) && (
                      <Card>
                        <CardContent className="p-4">
                          <div className="mb-2 text-xs font-medium text-text-tertiary uppercase tracking-wider">Evidence Balance</div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-accent-emerald">{supportingEvidence.length} for</span>
                            <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
                              {supportingEvidence.length + contrarianEvidence.length > 0 && (
                                <>
                                  <div
                                    className="bg-emerald-500 transition-all"
                                    style={{
                                      width: `${(supportingEvidence.length / (supportingEvidence.length + contrarianEvidence.length)) * 100}%`,
                                    }}
                                  />
                                  <div
                                    className="bg-rose-500 transition-all"
                                    style={{
                                      width: `${(contrarianEvidence.length / (supportingEvidence.length + contrarianEvidence.length)) * 100}%`,
                                    }}
                                  />
                                </>
                              )}
                            </div>
                            <span className="text-xs text-accent-rose">{contrarianEvidence.length} against</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Executive Summary */}
                    {executiveSummary && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Brain className="h-5 w-5 text-accent-blue" />
                            Executive Summary
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4 text-sm leading-relaxed text-text-secondary">
                            <p>{executiveSummary}</p>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Key Assumptions */}
                    {assumptions.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Shield className="h-5 w-5 text-accent-violet" />
                            Key Assumptions
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {assumptions.map((assumption, i) => (
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
                    )}
                  </TabsContent>

                  {/* Evidence Tab */}
                  {(supportingEvidence.length > 0 || contrarianEvidence.length > 0) && (
                    <TabsContent value="evidence" className="mt-6">
                      <div className="grid gap-6 lg:grid-cols-2">
                        {supportingEvidence.length > 0 && (
                          <Card>
                            <CardContent className="p-6">
                              <EvidenceList
                                title="Supporting Evidence"
                                items={supportingEvidence}
                              />
                            </CardContent>
                          </Card>
                        )}
                        {contrarianEvidence.length > 0 && (
                          <Card>
                            <CardContent className="p-6">
                              <EvidenceList
                                title="Contrarian Evidence"
                                items={contrarianEvidence}
                              />
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </TabsContent>
                  )}

                  {/* Risks Tab */}
                  {(risks.length > 0 || riskItems.length > 0) && (
                    <TabsContent value="risks" className="mt-6 space-y-6">
                      {riskItems.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                              <AlertTriangle className="h-5 w-5 text-accent-amber" />
                              Risk Matrix
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <RiskMatrix items={riskItems} />
                          </CardContent>
                        </Card>
                      )}

                      {structuredRisks.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                              <AlertTriangle className="h-5 w-5 text-accent-amber" />
                              Strategic Risks ({structuredRisks.length})
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              {structuredRisks.map((risk, i) => (
                                <div
                                  key={i}
                                  className="rounded-lg border border-border-primary bg-bg-secondary p-4"
                                >
                                  <div className="mb-2 flex items-center gap-2">
                                    <Badge variant={severityColor(risk.severity)}>
                                      {risk.severity}
                                    </Badge>
                                    <Badge variant="default">
                                      {risk.category}
                                    </Badge>
                                    <span className="text-xs text-text-tertiary">
                                      Likelihood: {risk.likelihood}
                                    </span>
                                  </div>
                                  <p className="text-sm text-text-primary">
                                    {risk.description}
                                  </p>
                                  {risk.mitigation && (
                                    <p className="mt-2 text-xs text-text-tertiary">
                                      <span className="font-medium text-accent-emerald">Mitigation:</span>{" "}
                                      {risk.mitigation}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>
                  )}

                  {/* Signals Tab */}
                  {signals.length > 0 && (
                    <TabsContent value="signals" className="mt-6">
                      <div className="grid gap-4 sm:grid-cols-2">
                        {signals.map((signal) => (
                          <SignalCard key={signal.id} signal={signal} />
                        ))}
                      </div>
                    </TabsContent>
                  )}

                  {/* Full Report Tab */}
                  <TabsContent value="report" className="mt-6">
                    <div className="mx-auto max-w-4xl">
                      {/* Report Actions Bar */}
                      <div className="mb-4 flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={handleCopyReport}>
                          <ClipboardCopy className="h-4 w-4" />
                          {copied ? "Copied!" : "Copy Report"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => window.print()}>
                          <Download className="h-4 w-4" />
                          Print / PDF
                        </Button>
                      </div>

                      {/* Formatted Report */}
                      <div className="rounded-xl border border-border-primary bg-bg-secondary shadow-lg print:shadow-none print:border-none">
                        {/* Report Header */}
                        <div className="border-b border-border-primary px-8 py-6">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-widest text-accent-blue">
                                Strategic Intelligence Report
                              </p>
                              <h1 className="mt-2 text-xl font-bold text-text-primary leading-tight">
                                {result?.query ?? question}
                              </h1>
                              <p className="mt-2 text-xs text-text-tertiary">
                                Prepared by Innovation Intelligence Copilot&ensp;·&ensp;
                                {result?.created_at
                                  ? new Date(result.created_at).toLocaleDateString("en-US", {
                                      year: "numeric", month: "long", day: "numeric",
                                    })
                                  : new Date().toLocaleDateString("en-US", {
                                      year: "numeric", month: "long", day: "numeric",
                                    })}
                                &ensp;·&ensp;Multi-Agent Analysis (6 agents)
                              </p>
                            </div>
                            {confidenceScore !== null && (
                              <div className="flex flex-col items-center rounded-lg border border-border-primary bg-bg-tertiary px-4 py-3">
                                <span className="text-2xl font-bold text-accent-blue">{gaugeScore}%</span>
                                <span className="text-[10px] uppercase tracking-wider text-text-tertiary">Confidence</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Executive Summary */}
                        {executiveSummary && (
                          <div className="border-b border-border-primary px-8 py-6">
                            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-tertiary">
                              Executive Summary
                            </h2>
                            <p className="text-sm leading-relaxed text-text-primary">
                              {executiveSummary}
                            </p>
                          </div>
                        )}

                        {/* Recommendation */}
                        {recommendation && (
                          <div className="border-b border-border-primary px-8 py-6">
                            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-tertiary">
                              Recommendation
                            </h2>
                            <div className="rounded-lg border-l-4 border-accent-blue bg-bg-tertiary px-4 py-3">
                              <p className="text-sm font-medium leading-relaxed text-text-primary">
                                {recommendation}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Key Metrics */}
                        <div className="border-b border-border-primary px-8 py-6">
                          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-tertiary">
                            Analysis Summary
                          </h2>
                          <div className="grid grid-cols-4 gap-4">
                            <div className="rounded-lg bg-bg-tertiary p-3 text-center">
                              <div className="text-lg font-bold text-accent-emerald">{supportingEvidence.length}</div>
                              <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Supporting Evidence</div>
                            </div>
                            <div className="rounded-lg bg-bg-tertiary p-3 text-center">
                              <div className="text-lg font-bold text-accent-rose">{contrarianEvidence.length}</div>
                              <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Contrarian Evidence</div>
                            </div>
                            <div className="rounded-lg bg-bg-tertiary p-3 text-center">
                              <div className="text-lg font-bold text-accent-amber">{structuredRisks.length}</div>
                              <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Risks Identified</div>
                            </div>
                            <div className="rounded-lg bg-bg-tertiary p-3 text-center">
                              <div className="text-lg font-bold text-accent-blue">{assumptions.length}</div>
                              <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Key Assumptions</div>
                            </div>
                          </div>
                        </div>

                        {/* Supporting Evidence */}
                        {supportingEvidence.length > 0 && (
                          <div className="border-b border-border-primary px-8 py-6">
                            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-tertiary">
                              Supporting Evidence
                            </h2>
                            <ol className="list-decimal space-y-2 pl-5">
                              {supportingEvidence.map((e, i) => (
                                <li key={i} className="text-sm leading-relaxed text-text-secondary pl-1">
                                  {e.claim}
                                  {e.source && e.source !== "Unknown" && (
                                    <span className="ml-1 text-xs text-text-tertiary">— {e.source}</span>
                                  )}
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {/* Contrarian Evidence */}
                        {contrarianEvidence.length > 0 && (
                          <div className="border-b border-border-primary px-8 py-6">
                            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-tertiary">
                              Contrarian Evidence &amp; Challenged Assumptions
                            </h2>
                            <ol className="list-decimal space-y-2 pl-5">
                              {contrarianEvidence.map((e, i) => (
                                <li key={i} className="text-sm leading-relaxed text-text-secondary pl-1">
                                  {e.claim}
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {/* Risk Assessment */}
                        {structuredRisks.length > 0 && (
                          <div className="border-b border-border-primary px-8 py-6">
                            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-tertiary">
                              Risk Assessment
                            </h2>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border-primary text-left text-[10px] uppercase tracking-wider text-text-tertiary">
                                  <th className="pb-2 pr-3">Risk</th>
                                  <th className="pb-2 pr-3 w-20">Category</th>
                                  <th className="pb-2 pr-3 w-20">Severity</th>
                                  <th className="pb-2 w-24">Likelihood</th>
                                </tr>
                              </thead>
                              <tbody>
                                {structuredRisks.map((risk, i) => (
                                  <tr key={i} className="border-b border-border-primary/50 last:border-0">
                                    <td className="py-3 pr-3 text-text-secondary">
                                      <p>{risk.description}</p>
                                      {risk.mitigation && (
                                        <p className="mt-1 text-xs text-text-tertiary italic">
                                          Mitigation: {risk.mitigation}
                                        </p>
                                      )}
                                    </td>
                                    <td className="py-3 pr-3 align-top">
                                      <Badge variant="default">{risk.category}</Badge>
                                    </td>
                                    <td className="py-3 pr-3 align-top">
                                      <Badge variant={severityColor(risk.severity)}>{risk.severity}</Badge>
                                    </td>
                                    <td className="py-3 align-top text-xs text-text-tertiary capitalize">
                                      {risk.likelihood}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Key Assumptions */}
                        {assumptions.length > 0 && (
                          <div className="border-b border-border-primary px-8 py-6">
                            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-tertiary">
                              Key Assumptions
                            </h2>
                            <ul className="space-y-2">
                              {assumptions.map((a, i) => (
                                <li key={i} className="flex gap-2 text-sm text-text-secondary">
                                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-blue" />
                                  {a}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Report Footer */}
                        <div className="px-8 py-4">
                          <div className="flex items-center justify-between text-[10px] text-text-tertiary">
                            <span>
                              Generated by Innovation Intelligence Copilot — Multi-Agent AI Analysis Platform
                            </span>
                            <span>
                              Confidential — For Internal Use Only
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
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

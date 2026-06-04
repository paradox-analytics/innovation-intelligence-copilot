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

function extractStrings(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => String(item));
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
  const [question, setQuestion] = useState("");
  const [historySidebarOpen, setHistorySidebarOpen] = useState(false);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [copied, setCopied] = useState(false);

  const { result, status, error, agentProgress, submit, reset } = useAnalysis();

  const isLoading = status === "submitting" || status === "streaming" || status === "polling";
  const isComplete = status === "complete" && result !== null;
  const isIdle = status === "idle";

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
    setQuestion("");
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
  const risks = extractStrings(analysisResult?.risks ?? analysisResult?.strategic_risks);
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

                      {risks.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                              <AlertTriangle className="h-5 w-5 text-accent-amber" />
                              Strategic Risks
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-2">
                              {risks.map((risk, i) => (
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
                            {fullReportText}
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

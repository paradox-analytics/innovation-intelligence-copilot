"use client";

import { DashboardLayout } from "@/components/dashboard/layout";
import { ConfidenceGauge } from "@/components/reports/confidence-gauge";
import {
  ComparisonView,
  type AnalysisSummary,
} from "@/components/reports/comparison-view";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  ArrowLeftRight,
  Calendar,
  ChevronRight,
  ClipboardCopy,
  FileJson,
  FileText,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

// --- Types ---

interface Report {
  id: string;
  question: string;
  recommendation: string;
  confidence: number;
  date: string;
  status: "complete" | "processing";
  executiveSummary: string;
  risks: string[];
  assumptions: string[];
  fullReport: string;
}

// --- Helpers ---

function getRecommendationBadge(confidence: number): {
  label: string;
  variant: BadgeVariant;
} {
  const score = confidence <= 1 ? confidence * 100 : confidence;
  if (score >= 70) return { label: "Proceed", variant: "emerald" };
  if (score >= 50) return { label: "Caution", variant: "amber" };
  return { label: "Avoid", variant: "rose" };
}

function normalizeScore(score: number): number {
  return score <= 1 ? Math.round(score * 100) : Math.round(score);
}

function extractStrings(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.map((item) => String(item));
}

function savedAnalysisToReport(saved: {
  id: string;
  question: string;
  timestamp: string;
  confidence: number | null;
  result?: Record<string, unknown> | null;
}): Report {
  const result = saved.result || {};
  const confidence = saved.confidence ?? 0;
  const recommendation = result.recommendation
    ? String(result.recommendation)
    : "";
  const executiveSummary = result.executive_summary
    ? String(result.executive_summary)
    : "";
  const risks = extractStrings(
    result.risks ?? result.strategic_risks
  );
  const assumptions = extractStrings(result.key_assumptions);

  // Build a full report from available data
  const sections = [
    `# Strategic Analysis: ${saved.question}`,
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

  return {
    id: saved.id,
    question: saved.question,
    recommendation,
    confidence: normalizeScore(confidence),
    date: new Date(saved.timestamp).toLocaleDateString(),
    status: "complete",
    executiveSummary,
    risks,
    assumptions,
    fullReport: sections,
  };
}

export default function ReportsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [copied, setCopied] = useState(false);

  // Data state
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  // Load reports from localStorage saved analyses (same source as analyze page)
  useEffect(() => {
    setLoading(true);
    try {
      const stored = localStorage.getItem("iic-analyses");
      if (stored) {
        const parsed = JSON.parse(stored) as Array<{
          id: string;
          question: string;
          timestamp: string;
          confidence: number | null;
        }>;

        // Also try to load cached results
        const reportList: Report[] = parsed.map((saved) => {
          // Try to load detailed result from individual cache
          let result: Record<string, unknown> | null = null;
          try {
            const cachedResult = localStorage.getItem(
              `iic-analysis-${saved.id}`
            );
            if (cachedResult) {
              result = JSON.parse(cachedResult) as Record<string, unknown>;
            }
          } catch {
            // ignore
          }
          return savedAnalysisToReport({ ...saved, result });
        });

        setReports(reportList);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredReports = reports.filter(
    (r) =>
      r.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.recommendation.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleCompareSelect = (id: string) => {
    setCompareSelection((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const handleExportMarkdown = (report: Report) => {
    const blob = new Blob([report.fullReport], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `report-${report.id}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportJson = (report: Report) => {
    const data = {
      id: report.id,
      question: report.question,
      recommendation: report.recommendation,
      confidence: report.confidence,
      date: report.date,
      executiveSummary: report.executiveSummary,
      risks: report.risks,
      assumptions: report.assumptions,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `report-${report.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyReport = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const compareReportA = reports.find((r) => r.id === compareSelection[0]);
  const compareReportB = reports.find((r) => r.id === compareSelection[1]);

  const toAnalysisSummary = (report: Report): AnalysisSummary => ({
    id: report.id,
    question: report.question,
    recommendation: report.recommendation,
    confidence: report.confidence,
    date: report.date,
    risks: report.risks,
    assumptions: report.assumptions,
  });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Reports</h1>
            <p className="mt-1 text-text-secondary">
              View and export generated analysis reports.
            </p>
          </div>
          <div className="flex gap-2">
            {reports.length >= 2 && (
              <Button
                variant={compareMode ? "primary" : "outline"}
                size="sm"
                onClick={() => {
                  setCompareMode(!compareMode);
                  setCompareSelection([]);
                }}
              >
                <ArrowLeftRight className="h-4 w-4" />
                {compareMode ? "Exit Compare" : "Compare"}
              </Button>
            )}
          </div>
        </div>

        {/* Compare bar */}
        {compareMode && (
          <div className="flex items-center justify-between rounded-lg border border-accent-blue/30 bg-accent-blue/5 px-4 py-3 animate-fade-in">
            <p className="text-sm text-text-secondary">
              Select 2 reports to compare side by side.{" "}
              <span className="font-medium text-accent-blue">
                {compareSelection.length}/2 selected
              </span>
            </p>
            {compareSelection.length === 2 && (
              <Button size="sm" onClick={() => setShowCompare(true)}>
                Compare Now
              </Button>
            )}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
          </div>
        )}

        {/* Empty state */}
        {!loading && reports.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="mx-auto h-12 w-12 text-text-muted/50" />
              <h3 className="mt-4 text-sm font-semibold text-text-primary">
                No reports yet
              </h3>
              <p className="mt-1 text-sm text-text-muted">
                Run a strategic analysis to generate your first report.
              </p>
              <Link href="/analyze">
                <Button className="mt-4">
                  <Sparkles className="h-4 w-4" />
                  Run Analysis
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        {!loading && reports.length > 0 && (
          <>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-border-default bg-bg-tertiary py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
              />
            </div>

            {/* Report list */}
            <div className="space-y-3">
              {filteredReports.map((report) => {
                const badge = getRecommendationBadge(report.confidence);
                const isSelected = compareSelection.includes(report.id);
                return (
                  <Card
                    key={report.id}
                    className={cn(
                      "transition-all duration-200 hover:border-accent-blue/30 cursor-pointer",
                      isSelected && "border-accent-blue/50 bg-accent-blue/5"
                    )}
                    onClick={() => {
                      if (compareMode) {
                        toggleCompareSelect(report.id);
                      } else {
                        setSelectedReport(report);
                      }
                    }}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        {compareMode && (
                          <div className="mt-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCompareSelect(report.id)}
                              className="rounded border-border-default bg-bg-tertiary"
                            />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="text-sm font-semibold text-text-primary">
                              {report.question}
                            </h3>
                            <div className="flex shrink-0 items-center gap-2">
                              <Badge variant={badge.variant}>
                                {badge.label}
                              </Badge>
                              <ConfidenceGauge
                                score={report.confidence}
                                size={48}
                                strokeWidth={4}
                              />
                            </div>
                          </div>
                          {report.recommendation && (
                            <p className="mt-2 text-sm text-text-secondary line-clamp-2">
                              {report.recommendation}
                            </p>
                          )}
                          <div className="mt-3 flex items-center gap-4 text-xs text-text-muted">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {report.date}
                            </span>
                            {report.risks.length > 0 && (
                              <span>
                                {report.risks.length} risks identified
                              </span>
                            )}
                          </div>
                        </div>
                        {!compareMode && (
                          <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-text-muted" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {filteredReports.length === 0 && reports.length > 0 && (
                <div className="py-12 text-center text-sm text-text-muted">
                  No reports found matching your search.
                </div>
              )}
            </div>
          </>
        )}

        {/* Report Detail Modal */}
        <Dialog
          open={selectedReport !== null}
          onClose={() => setSelectedReport(null)}
          className="max-w-2xl"
        >
          {selectedReport && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedReport.question}</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <Tabs defaultValue="summary">
                  <TabsList className="w-fit">
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="report">Full Report</TabsTrigger>
                  </TabsList>

                  <TabsContent value="summary" className="mt-4 space-y-5">
                    {/* Confidence + Recommendation */}
                    <div className="flex items-center gap-4">
                      <ConfidenceGauge
                        score={selectedReport.confidence}
                        size={80}
                        strokeWidth={6}
                      />
                      <div className="space-y-1">
                        <Badge
                          variant={
                            getRecommendationBadge(
                              selectedReport.confidence
                            ).variant
                          }
                        >
                          {
                            getRecommendationBadge(
                              selectedReport.confidence
                            ).label
                          }
                        </Badge>
                        <p className="text-xs text-text-muted">
                          {selectedReport.date}
                        </p>
                      </div>
                    </div>

                    {/* Recommendation */}
                    {selectedReport.recommendation && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium uppercase text-text-muted">
                          Recommendation
                        </p>
                        <p className="text-sm text-text-primary">
                          {selectedReport.recommendation}
                        </p>
                      </div>
                    )}

                    {/* Executive Summary */}
                    {selectedReport.executiveSummary && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium uppercase text-text-muted">
                          Executive Summary
                        </p>
                        <p className="text-sm leading-relaxed text-text-secondary">
                          {selectedReport.executiveSummary}
                        </p>
                      </div>
                    )}

                    {/* Risks */}
                    {selectedReport.risks.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase text-text-muted">
                          Risks ({selectedReport.risks.length})
                        </p>
                        <ul className="space-y-1.5">
                          {selectedReport.risks.map((risk, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-xs text-text-secondary"
                            >
                              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent-amber" />
                              {risk}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="report" className="mt-4">
                    {selectedReport.fullReport ? (
                      <div className="rounded-lg bg-bg-tertiary p-4">
                        <pre className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary font-sans">
                          {selectedReport.fullReport}
                        </pre>
                      </div>
                    ) : (
                      <p className="py-8 text-center text-sm text-text-muted">
                        No detailed report available for this analysis.
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              </DialogBody>
              <DialogFooter>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleCopyReport(selectedReport.fullReport)
                  }
                >
                  <ClipboardCopy className="h-4 w-4" />
                  {copied ? "Copied!" : "Copy"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportMarkdown(selectedReport)}
                >
                  <FileText className="h-4 w-4" />
                  Markdown
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportJson(selectedReport)}
                >
                  <FileJson className="h-4 w-4" />
                  JSON
                </Button>
              </DialogFooter>
            </>
          )}
        </Dialog>

        {/* Comparison Dialog */}
        <Dialog
          open={
            showCompare &&
            compareReportA !== undefined &&
            compareReportB !== undefined
          }
          onClose={() => setShowCompare(false)}
          className="max-w-4xl"
        >
          {compareReportA && compareReportB && (
            <>
              <DialogHeader>
                <DialogTitle>Analysis Comparison</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <ComparisonView
                  left={toAnalysisSummary(compareReportA)}
                  right={toAnalysisSummary(compareReportB)}
                />
              </DialogBody>
              <DialogFooter>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCompare(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

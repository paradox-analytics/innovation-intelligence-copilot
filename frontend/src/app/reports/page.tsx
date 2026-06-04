"use client";

import { DashboardLayout } from "@/components/dashboard/layout";
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

interface StructuredRisk {
  description: string;
  category: string;
  severity: string;
  likelihood: string;
  mitigation: string;
}

interface Report {
  id: string;
  question: string;
  recommendation: string;
  confidence: number;
  date: string;
  status: "complete" | "processing";
  executiveSummary: string;
  risks: StructuredRisk[];
  assumptions: string[];
  supportingCount: number;
  contrarianCount: number;
}

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

function severityColor(severity: string): BadgeVariant {
  switch (severity.toLowerCase()) {
    case "critical": return "rose";
    case "high": return "amber";
    case "medium": return "default";
    case "low": return "emerald";
    default: return "default";
  }
}

function extractStrings(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.map((item) =>
    typeof item === "object" && item !== null && "description" in item
      ? String((item as Record<string, unknown>).description)
      : String(item)
  );
}

function extractRisks(val: unknown): StructuredRisk[] {
  if (!Array.isArray(val)) return [];
  return val.map((item: Record<string, unknown>) => ({
    description: String(item.description ?? ""),
    category: String(item.category ?? "general"),
    severity: String(item.severity ?? "medium"),
    likelihood: String(item.likelihood ?? "possible"),
    mitigation: String(item.mitigation ?? ""),
  }));
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
  const risks = extractRisks(result.risks ?? result.strategic_risks);
  const assumptions = extractStrings(result.key_assumptions);
  const supportingCount = Array.isArray(result.supporting_evidence) ? result.supporting_evidence.length : 0;
  const contrarianCount = Array.isArray(result.contrarian_evidence) ? result.contrarian_evidence.length : 0;

  return {
    id: saved.id,
    question: saved.question,
    recommendation,
    confidence: normalizeScore(confidence),
    date: new Date(saved.timestamp).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    }),
    status: "complete",
    executiveSummary,
    risks,
    assumptions,
    supportingCount,
    contrarianCount,
  };
}

export default function ReportsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

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
        const reportList: Report[] = parsed.map((saved) => {
          let result: Record<string, unknown> | null = null;
          try {
            const cachedResult = localStorage.getItem(`iic-analysis-${saved.id}`);
            if (cachedResult) {
              result = JSON.parse(cachedResult) as Record<string, unknown>;
            }
          } catch { /* ignore */ }
          return savedAnalysisToReport({ ...saved, result });
        });
        setReports(reportList);
      }
    } catch { /* ignore */ } finally {
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

  const handleCopyReport = async (report: Report) => {
    const text = [
      `STRATEGIC INTELLIGENCE REPORT`,
      ``,
      report.question,
      `Confidence: ${report.confidence}%`,
      `Date: ${report.date}`,
      ``,
      `RECOMMENDATION`,
      report.recommendation,
      ``,
      `EXECUTIVE SUMMARY`,
      report.executiveSummary,
      ``,
      `RISKS (${report.risks.length})`,
      ...report.risks.map((r, i) => `${i + 1}. [${r.severity}/${r.category}] ${r.description}`),
      ``,
      `KEY ASSUMPTIONS`,
      ...report.assumptions.map((a, i) => `${i + 1}. ${a}`),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleExportJson = (report: Report) => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `report-${report.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const compareReportA = reports.find((r) => r.id === compareSelection[0]);
  const compareReportB = reports.find((r) => r.id === compareSelection[1]);

  const toAnalysisSummary = (report: Report): AnalysisSummary => ({
    id: report.id,
    question: report.question,
    recommendation: report.recommendation,
    confidence: report.confidence,
    date: report.date,
    risks: report.risks.map((r) => r.description),
    assumptions: report.assumptions,
  });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
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

        {compareMode && (
          <div className="flex items-center justify-between rounded-lg border border-accent-blue/30 bg-accent-blue/5 px-4 py-3 animate-fade-in">
            <p className="text-sm text-text-secondary">
              Select 2 reports to compare.{" "}
              <span className="font-medium text-accent-blue">{compareSelection.length}/2 selected</span>
            </p>
            {compareSelection.length === 2 && (
              <Button size="sm" onClick={() => setShowCompare(true)}>Compare Now</Button>
            )}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
          </div>
        )}

        {!loading && reports.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="mx-auto h-12 w-12 text-text-muted/50" />
              <h3 className="mt-4 text-sm font-semibold text-text-primary">No reports yet</h3>
              <p className="mt-1 text-sm text-text-muted">Run a strategic analysis to generate your first report.</p>
              <Link href="/analyze">
                <Button className="mt-4">
                  <Sparkles className="h-4 w-4" />
                  Run Analysis
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

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

            <div className="space-y-3">
              {filteredReports.map((report) => {
                const badge = getRecommendationBadge(report.confidence);
                const isSelected = compareSelection.includes(report.id);
                return (
                  <Card
                    key={report.id}
                    className={`transition-all duration-200 hover:border-accent-blue/30 cursor-pointer ${
                      isSelected ? "border-accent-blue/50 bg-accent-blue/5" : ""
                    }`}
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
                              <Badge variant={badge.variant}>{badge.label}</Badge>
                              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-accent-blue">
                                <span className="text-xs font-bold text-accent-blue">{report.confidence}%</span>
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-4 text-xs text-text-muted">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {report.date}
                            </span>
                            {report.risks.length > 0 && (
                              <span>{report.risks.length} risks</span>
                            )}
                            {report.supportingCount > 0 && (
                              <span className="text-accent-emerald">{report.supportingCount} supporting</span>
                            )}
                            {report.contrarianCount > 0 && (
                              <span className="text-accent-rose">{report.contrarianCount} contrarian</span>
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
            </div>
          </>
        )}

        {/* Report Detail Modal — Professional Format */}
        <Dialog
          open={selectedReport !== null}
          onClose={() => setSelectedReport(null)}
          className="max-w-3xl"
        >
          {selectedReport && (
            <>
              <DialogBody>
                <div className="space-y-6">
                  {/* Header */}
                  <div className="border-b border-border-primary pb-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-accent-blue">
                      Strategic Intelligence Report
                    </p>
                    <h2 className="mt-2 text-lg font-bold text-text-primary leading-tight">
                      {selectedReport.question}
                    </h2>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-accent-blue">
                        <span className="text-sm font-bold text-accent-blue">{selectedReport.confidence}%</span>
                      </div>
                      <div>
                        <Badge variant={getRecommendationBadge(selectedReport.confidence).variant}>
                          {getRecommendationBadge(selectedReport.confidence).label}
                        </Badge>
                        <p className="mt-0.5 text-xs text-text-tertiary">{selectedReport.date}</p>
                      </div>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="rounded-lg bg-bg-tertiary p-3 text-center">
                      <div className="text-lg font-bold text-accent-emerald">{selectedReport.supportingCount}</div>
                      <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Supporting</div>
                    </div>
                    <div className="rounded-lg bg-bg-tertiary p-3 text-center">
                      <div className="text-lg font-bold text-accent-rose">{selectedReport.contrarianCount}</div>
                      <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Contrarian</div>
                    </div>
                    <div className="rounded-lg bg-bg-tertiary p-3 text-center">
                      <div className="text-lg font-bold text-accent-amber">{selectedReport.risks.length}</div>
                      <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Risks</div>
                    </div>
                    <div className="rounded-lg bg-bg-tertiary p-3 text-center">
                      <div className="text-lg font-bold text-accent-blue">{selectedReport.assumptions.length}</div>
                      <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Assumptions</div>
                    </div>
                  </div>

                  {/* Recommendation */}
                  {selectedReport.recommendation && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-tertiary">Recommendation</p>
                      <div className="rounded-lg border-l-4 border-accent-blue bg-bg-tertiary px-4 py-3">
                        <p className="text-sm font-medium text-text-primary">{selectedReport.recommendation}</p>
                      </div>
                    </div>
                  )}

                  {/* Executive Summary */}
                  {selectedReport.executiveSummary && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-tertiary">Executive Summary</p>
                      <p className="text-sm leading-relaxed text-text-secondary">{selectedReport.executiveSummary}</p>
                    </div>
                  )}

                  {/* Risks Table */}
                  {selectedReport.risks.length > 0 && (
                    <div>
                      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-tertiary">
                        Risk Assessment ({selectedReport.risks.length})
                      </p>
                      <div className="space-y-3">
                        {selectedReport.risks.map((risk, i) => (
                          <div key={i} className="rounded-lg border border-border-primary bg-bg-tertiary p-3">
                            <div className="mb-1.5 flex items-center gap-2">
                              <Badge variant={severityColor(risk.severity)}>{risk.severity}</Badge>
                              <Badge variant="default">{risk.category}</Badge>
                              <span className="text-[10px] text-text-tertiary">Likelihood: {risk.likelihood}</span>
                            </div>
                            <p className="text-sm text-text-primary">{risk.description}</p>
                            {risk.mitigation && (
                              <p className="mt-1.5 text-xs text-text-tertiary">
                                <span className="font-medium text-accent-emerald">Mitigation:</span> {risk.mitigation}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assumptions */}
                  {selectedReport.assumptions.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-tertiary">Key Assumptions</p>
                      <ul className="space-y-1.5">
                        {selectedReport.assumptions.map((a, i) => (
                          <li key={i} className="flex gap-2 text-sm text-text-secondary">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-blue" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => handleCopyReport(selectedReport)}>
                  <ClipboardCopy className="h-4 w-4" />
                  {copied ? "Copied!" : "Copy"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExportJson(selectedReport)}>
                  <FileJson className="h-4 w-4" />
                  JSON
                </Button>
                <Link href={`/analyze?id=${selectedReport.id}`}>
                  <Button size="sm">
                    View Full Analysis
                  </Button>
                </Link>
              </DialogFooter>
            </>
          )}
        </Dialog>

        {/* Comparison Dialog */}
        <Dialog
          open={showCompare && compareReportA !== undefined && compareReportB !== undefined}
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
                <Button variant="outline" size="sm" onClick={() => setShowCompare(false)}>
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

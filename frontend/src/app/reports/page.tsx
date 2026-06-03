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
  Search,
} from "lucide-react";
import { useState } from "react";

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

// --- Mock data ---

const MOCK_REPORTS: Report[] = [
  {
    id: "r1",
    question: "Should BASF invest in microbial fermentation for specialty chemicals?",
    recommendation: "Proceed with staged investment starting with a $50-80M pilot facility leveraging existing fermentation infrastructure.",
    confidence: 73,
    date: "2024-01-22",
    status: "complete",
    executiveSummary: "The microbial fermentation opportunity for specialty chemicals represents a strategically attractive but execution-dependent investment for BASF. Market fundamentals are strong with 48% CAGR growth. A staged approach de-risks capital commitment while preserving first-mover positioning.",
    risks: [
      "Scale-up execution risk (60% failure rate)",
      "Feedstock price volatility",
      "Novozymes/DSM merger competitive threat",
      "Regulatory timeline uncertainty",
      "Capital intensity ($200-400M)",
    ],
    assumptions: [
      "Leverage existing fermentation infrastructure",
      "Favorable EU regulatory trajectory through 2030",
      "15-25% bio-based price premium sustained",
      "Target yields achievable in 24 months",
    ],
    fullReport: "# Strategic Analysis: BASF Microbial Fermentation Investment\n\n## Executive Summary\n\nThe microbial fermentation opportunity for specialty chemicals represents a strategically attractive but execution-dependent investment for BASF.\n\n## Recommendation\n\nProceed with a staged investment in microbial fermentation for specialty chemicals. Begin with a $50-80M pilot facility.\n\n## Market Context\n\n- Precision fermentation market: $36.3B by 2030 (48.1% CAGR)\n- Bio-based chemicals market: $98.5B in 2023\n- EU Green Deal providing significant regulatory tailwinds\n\n## Risk Assessment\n\nThe primary risk is scale-up execution with a 60% industry failure rate. The Novozymes/DSM merger creates a formidable competitor.\n\n## Conclusion\n\nFull scale-up should be gated on achieving 85%+ theoretical yield within 24 months.",
  },
  {
    id: "r2",
    question: "What is the competitive landscape for AI-powered drug discovery in oncology?",
    recommendation: "Invest in partnerships with 2-3 leading AI drug discovery platforms rather than building in-house capabilities.",
    confidence: 68,
    date: "2024-01-20",
    status: "complete",
    executiveSummary: "The AI drug discovery space in oncology is rapidly maturing with significant consolidation expected. Partnership strategy is recommended over build, given the specialized talent requirements and fast-moving technology landscape.",
    risks: [
      "Rapid technology obsolescence",
      "Talent war for ML/drug discovery specialists",
      "Regulatory uncertainty for AI-discovered drugs",
      "High partnership costs ($50-100M per platform)",
    ],
    assumptions: [
      "AI will reduce drug discovery timeline by 30-50%",
      "FDA will develop clear guidance for AI-discovered drugs by 2026",
      "Partnership costs justified by reduced failure rates",
    ],
    fullReport: "# AI Drug Discovery in Oncology: Competitive Landscape\n\n## Executive Summary\n\nThe AI drug discovery space in oncology is rapidly maturing with significant consolidation expected.\n\n## Key Players\n\n- Recursion Pharmaceuticals\n- Insilico Medicine\n- Exscientia\n- BenevolentAI\n\n## Recommendation\n\nPartnership strategy recommended over build approach.\n\n## Risk Assessment\n\nRapid technology evolution makes in-house builds risky. Partnership de-risks while maintaining access to cutting-edge capabilities.",
  },
  {
    id: "r3",
    question: "Should we acquire TechStartup Inc. for their quantum computing portfolio?",
    recommendation: "Proceed with caution. Conduct extended due diligence focusing on IP validity and team retention risk.",
    confidence: 52,
    date: "2024-01-18",
    status: "complete",
    executiveSummary: "TechStartup Inc. has promising quantum computing IP but significant team concentration risk. The technology is pre-commercial and valuation appears aggressive relative to comparable transactions.",
    risks: [
      "Key person dependency (3 researchers hold critical IP)",
      "Pre-commercial technology with uncertain timeline",
      "Aggressive valuation (8x revenue)",
      "Integration complexity with existing R&D",
      "Quantum computing winter risk",
    ],
    assumptions: [
      "Key researchers will be retained post-acquisition",
      "Quantum advantage in target applications within 5 years",
      "Regulatory approval for quantum-derived products",
    ],
    fullReport: "# Acquisition Analysis: TechStartup Inc. Quantum Computing Portfolio\n\n## Executive Summary\n\nTechStartup Inc. has promising quantum computing IP but significant risks.\n\n## Valuation\n\nCurrent ask: $2.1B (8x revenue)\nComparable transactions suggest 5-6x is more appropriate.\n\n## Recommendation\n\nProceed with caution. Extended due diligence recommended.\n\n## Key Risks\n\nTeam concentration risk is the primary concern. Three researchers hold 80% of critical IP.",
  },
  {
    id: "r4",
    question: "Market entry strategy for Southeast Asian renewable energy sector?",
    recommendation: "Enter via Vietnam and Indonesia, focusing on solar + battery storage. Partner with local developers for permitting and grid access.",
    confidence: 81,
    date: "2024-01-15",
    status: "complete",
    executiveSummary: "Southeast Asia presents a compelling renewable energy opportunity with strong government mandates, declining technology costs, and limited incumbent competition. Vietnam and Indonesia offer the best risk-adjusted returns.",
    risks: [
      "Grid infrastructure limitations",
      "Currency risk in emerging markets",
      "Regulatory change risk post-election cycles",
    ],
    assumptions: [
      "Solar LCOE continues declining at 5-8% annually",
      "Battery storage costs reach $100/kWh by 2026",
      "Local partnerships sufficient for regulatory navigation",
    ],
    fullReport: "# Southeast Asian Renewable Energy Market Entry\n\n## Executive Summary\n\nSoutheast Asia presents a compelling renewable energy opportunity.\n\n## Target Markets\n\n1. Vietnam - Strongest grid and policy framework\n2. Indonesia - Largest market, archipelago complexity\n\n## Entry Strategy\n\nPartner-led model with local developers for permitting.\n\n## Financial Projections\n\nExpected IRR: 14-18% for solar, 12-15% for solar+storage.",
  },
];

function getRecommendationBadge(confidence: number): {
  label: string;
  variant: BadgeVariant;
} {
  if (confidence >= 70) return { label: "Proceed", variant: "emerald" };
  if (confidence >= 50) return { label: "Caution", variant: "amber" };
  return { label: "Avoid", variant: "rose" };
}

export default function ReportsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [copied, setCopied] = useState(false);

  const filteredReports = MOCK_REPORTS.filter(
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

  const compareReportA = MOCK_REPORTS.find((r) => r.id === compareSelection[0]);
  const compareReportB = MOCK_REPORTS.find((r) => r.id === compareSelection[1]);

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

        {/* Search */}
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
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          <ConfidenceGauge
                            score={report.confidence}
                            size={48}
                            strokeWidth={4}
                          />
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-text-secondary line-clamp-2">
                        {report.recommendation}
                      </p>
                      <div className="mt-3 flex items-center gap-4 text-xs text-text-muted">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {report.date}
                        </span>
                        <span>{report.risks.length} risks identified</span>
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

          {filteredReports.length === 0 && (
            <div className="py-12 text-center text-sm text-text-muted">
              No reports found matching your search.
            </div>
          )}
        </div>

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
                            getRecommendationBadge(selectedReport.confidence)
                              .variant
                          }
                        >
                          {
                            getRecommendationBadge(selectedReport.confidence)
                              .label
                          }
                        </Badge>
                        <p className="text-xs text-text-muted">
                          {selectedReport.date}
                        </p>
                      </div>
                    </div>

                    {/* Recommendation */}
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase text-text-muted">
                        Recommendation
                      </p>
                      <p className="text-sm text-text-primary">
                        {selectedReport.recommendation}
                      </p>
                    </div>

                    {/* Executive Summary */}
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase text-text-muted">
                        Executive Summary
                      </p>
                      <p className="text-sm leading-relaxed text-text-secondary">
                        {selectedReport.executiveSummary}
                      </p>
                    </div>

                    {/* Risks */}
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
                  </TabsContent>

                  <TabsContent value="report" className="mt-4">
                    <div className="rounded-lg bg-bg-tertiary p-4">
                      <pre className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary font-sans">
                        {selectedReport.fullReport}
                      </pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </DialogBody>
              <DialogFooter>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyReport(selectedReport.fullReport)}
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

"use client";

import { cn } from "@/lib/utils";
import { ConfidenceGauge } from "./confidence-gauge";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

interface AnalysisSummary {
  id: string;
  question: string;
  recommendation: string;
  confidence: number;
  date: string;
  risks: string[];
  assumptions: string[];
}

interface ComparisonViewProps {
  left: AnalysisSummary;
  right: AnalysisSummary;
  className?: string;
}

function ComparisonColumn({
  analysis,
  side: _side,
}: {
  analysis: AnalysisSummary;
  side: "left" | "right";
}) {
  return (
    <div className="flex-1 space-y-5">
      {/* Question */}
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase text-text-muted">
          Question
        </p>
        <p className="text-sm font-medium text-text-primary">
          {analysis.question}
        </p>
        <p className="text-xs text-text-muted">{analysis.date}</p>
      </div>

      {/* Confidence */}
      <div className="flex items-center gap-4">
        <ConfidenceGauge score={analysis.confidence} size={80} strokeWidth={6} />
        <div>
          <p className="text-sm font-medium text-text-primary">
            {analysis.confidence}% confidence
          </p>
          <Badge
            variant={
              analysis.confidence >= 70
                ? "emerald"
                : analysis.confidence >= 50
                ? "amber"
                : "rose"
            }
          >
            {analysis.confidence >= 70
              ? "Proceed"
              : analysis.confidence >= 50
              ? "Caution"
              : "Avoid"}
          </Badge>
        </div>
      </div>

      {/* Recommendation */}
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase text-text-muted">
          Recommendation
        </p>
        <p className="text-sm leading-relaxed text-text-secondary">
          {analysis.recommendation}
        </p>
      </div>

      {/* Risks */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase text-text-muted">
          Key Risks ({analysis.risks.length})
        </p>
        <ul className="space-y-1.5">
          {analysis.risks.slice(0, 3).map((risk, i) => (
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

      {/* Assumptions */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase text-text-muted">
          Key Assumptions ({analysis.assumptions.length})
        </p>
        <ul className="space-y-1.5">
          {analysis.assumptions.slice(0, 3).map((assumption, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-xs text-text-secondary"
            >
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent-violet" />
              {assumption}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ComparisonView({
  left,
  right,
  className,
}: ComparisonViewProps) {
  return (
    <div className={cn("flex gap-6", className)}>
      <ComparisonColumn analysis={left} side="left" />

      {/* Divider */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex-1 w-px bg-border-default" />
        <div className="rounded-full border border-border-default bg-bg-tertiary p-1.5">
          <ArrowRight className="h-3 w-3 text-text-muted rotate-90 sm:rotate-0" />
        </div>
        <div className="flex-1 w-px bg-border-default" />
      </div>

      <ComparisonColumn analysis={right} side="right" />
    </div>
  );
}

export type { AnalysisSummary };

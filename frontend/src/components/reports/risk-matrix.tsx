"use client";

import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

interface RiskItem {
  id: string;
  label: string;
  likelihood: 1 | 2 | 3 | 4 | 5;
  severity: 1 | 2 | 3 | 4 | 5;
  description?: string;
}

interface RiskMatrixProps {
  items: RiskItem[];
  className?: string;
}

const likelihoodLabels = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"];
const severityLabels = ["Negligible", "Minor", "Moderate", "Major", "Catastrophic"];

function getCellColor(likelihood: number, severity: number): string {
  const score = likelihood * severity;
  if (score >= 16) return "bg-accent-rose/20 border-accent-rose/30";
  if (score >= 10) return "bg-accent-amber/20 border-accent-amber/30";
  if (score >= 5) return "bg-accent-blue/20 border-accent-blue/30";
  return "bg-accent-emerald/20 border-accent-emerald/30";
}

function getDotColor(likelihood: number, severity: number): string {
  const score = likelihood * severity;
  if (score >= 16) return "bg-accent-rose";
  if (score >= 10) return "bg-accent-amber";
  if (score >= 5) return "bg-accent-blue";
  return "bg-accent-emerald";
}

export function RiskMatrix({ items, className }: RiskMatrixProps) {
  // Group items by cell
  const cellItems: Record<string, RiskItem[]> = {};
  for (const item of items) {
    const key = `${item.likelihood}-${item.severity}`;
    if (!cellItems[key]) cellItems[key] = [];
    cellItems[key].push(item);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-end gap-2">
        {/* Y-axis label */}
        <div className="flex w-20 shrink-0 items-center justify-center">
          <span className="origin-center -rotate-90 whitespace-nowrap text-xs font-medium text-text-muted">
            Likelihood
          </span>
        </div>

        {/* Grid */}
        <div className="flex-1">
          <div className="grid grid-cols-5 gap-1">
            {/* Render cells: severity on x (1-5), likelihood on y (5-1, top to bottom) */}
            {[5, 4, 3, 2, 1].map((likelihood) =>
              [1, 2, 3, 4, 5].map((severity) => {
                const key = `${likelihood}-${severity}`;
                const cellRisks = cellItems[key] || [];
                return (
                  <div
                    key={key}
                    className={cn(
                      "relative flex h-14 items-center justify-center rounded border",
                      getCellColor(likelihood, severity)
                    )}
                  >
                    {cellRisks.map((risk, i) => (
                      <Tooltip
                        key={risk.id}
                        content={
                          <div className="max-w-xs">
                            <p className="font-medium">{risk.label}</p>
                            {risk.description && (
                              <p className="mt-1 text-text-muted">
                                {risk.description}
                              </p>
                            )}
                          </div>
                        }
                        side="top"
                      >
                        <div
                          className={cn(
                            "h-4 w-4 rounded-full shadow-sm cursor-pointer ring-2 ring-bg-secondary transition-transform hover:scale-125",
                            getDotColor(likelihood, severity)
                          )}
                          style={{
                            marginLeft: i > 0 ? "-4px" : undefined,
                          }}
                        />
                      </Tooltip>
                    ))}
                  </div>
                );
              })
            )}
          </div>

          {/* X-axis labels */}
          <div className="mt-2 grid grid-cols-5 gap-1 text-center">
            {severityLabels.map((label) => (
              <span key={label} className="text-[10px] text-text-muted">
                {label}
              </span>
            ))}
          </div>
          <p className="mt-1 text-center text-xs font-medium text-text-muted">
            Severity
          </p>
        </div>
      </div>

      {/* Y-axis labels (right side) */}
      <div className="ml-22 flex items-start gap-2">
        <div className="grid gap-1">
          {[5, 4, 3, 2, 1].map((level) => (
            <div
              key={level}
              className="flex h-14 items-center text-[10px] text-text-muted"
            >
              {likelihoodLabels[level - 1]}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      {items.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <p className="text-xs font-medium text-text-secondary">Risks</p>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {items.map((risk) => (
              <div
                key={risk.id}
                className="flex items-center gap-2 rounded px-2 py-1 text-xs"
              >
                <div
                  className={cn(
                    "h-2.5 w-2.5 shrink-0 rounded-full",
                    getDotColor(risk.likelihood, risk.severity)
                  )}
                />
                <span className="text-text-secondary truncate">
                  {risk.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export type { RiskItem };

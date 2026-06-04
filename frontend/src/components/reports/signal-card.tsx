import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type TrendDirection = "up" | "down" | "stable";
type SignalHorizon = "near" | "mid" | "far";

interface SignalCardData {
  id: string;
  name: string;
  category: string;
  strength: number; // 0-100
  trend: TrendDirection;
  horizon: SignalHorizon;
  description: string;
  readinessLevel?: number; // 1-9 (TRL)
}

interface SignalCardProps {
  signal: SignalCardData;
  className?: string;
}

const trendConfig: Record<
  TrendDirection,
  { icon: React.ReactNode; label: string; color: string }
> = {
  up: {
    icon: <TrendingUp className="h-4 w-4" />,
    label: "Accelerating",
    color: "text-accent-emerald",
  },
  down: {
    icon: <TrendingDown className="h-4 w-4" />,
    label: "Decelerating",
    color: "text-accent-rose",
  },
  stable: {
    icon: <Minus className="h-4 w-4" />,
    label: "Stable",
    color: "text-text-muted",
  },
};

const horizonConfig: Record<
  SignalHorizon,
  { label: string; timeline: string; color: string }
> = {
  near: {
    label: "Near-term",
    timeline: "0-2 years",
    color: "emerald",
  },
  mid: {
    label: "Mid-term",
    timeline: "2-5 years",
    color: "amber",
  },
  far: {
    label: "Long-term",
    timeline: "5-10 years",
    color: "violet",
  },
};

function getStrengthColor(
  strength: number
): "emerald" | "blue" | "amber" | "rose" {
  if (strength >= 75) return "emerald";
  if (strength >= 50) return "blue";
  if (strength >= 25) return "amber";
  return "rose";
}

export function SignalCard({ signal, className }: SignalCardProps) {
  const trend = trendConfig[signal.trend];
  const horizon = horizonConfig[signal.horizon];

  return (
    <div
      className={cn(
        "rounded-lg border border-border-default bg-bg-secondary p-5 transition-all duration-200 hover:border-border-subtle hover:shadow-md hover:shadow-accent-blue/5",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-text-primary truncate">
            {signal.name}
          </h4>
          <p className="mt-0.5 text-xs text-text-muted">{signal.category}</p>
        </div>
        <div
          className={cn(
            "flex items-center gap-1 text-sm font-medium",
            trend.color
          )}
        >
          {trend.icon}
        </div>
      </div>

      {/* Description */}
      <p className="mt-3 text-sm leading-relaxed text-text-secondary line-clamp-2">
        {signal.description}
      </p>

      {/* Signal Strength */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-muted">Signal Strength</span>
          <span className="font-medium text-text-secondary">
            {signal.strength}%
          </span>
        </div>
        <Progress
          value={signal.strength}
          size="sm"
          color={getStrengthColor(signal.strength)}
        />
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <Badge
          variant={
            horizon.color as "emerald" | "amber" | "violet"
          }
        >
          {horizon.label}
        </Badge>
        <div className="flex items-center gap-1 text-xs text-text-muted">
          <ArrowRight className="h-3 w-3" />
          {horizon.timeline}
        </div>
      </div>

      {/* TRL if present */}
      {signal.readinessLevel !== undefined && (
        <div className="mt-3 flex items-center gap-2 border-t border-border-default pt-3">
          <span className="text-xs text-text-muted">TRL</span>
          <div className="flex gap-0.5">
            {Array.from({ length: 9 }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 w-3 rounded-sm",
                  i < signal.readinessLevel!
                    ? "bg-accent-blue"
                    : "bg-bg-tertiary"
                )}
              />
            ))}
          </div>
          <span className="text-xs text-text-secondary">
            {signal.readinessLevel}/9
          </span>
        </div>
      )}
    </div>
  );
}

export type { SignalCardData, TrendDirection, SignalHorizon };

import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { ReactNode } from "react";

type TrendDirection = "up" | "down" | "neutral";

interface StatsCardProps {
  label: string;
  value: string | number;
  trend?: TrendDirection;
  trendValue?: string;
  period?: string;
  icon?: ReactNode;
  className?: string;
}

const trendConfig: Record<
  TrendDirection,
  { icon: ReactNode; color: string }
> = {
  up: {
    icon: <TrendingUp className="h-3.5 w-3.5" />,
    color: "text-accent-emerald",
  },
  down: {
    icon: <TrendingDown className="h-3.5 w-3.5" />,
    color: "text-accent-rose",
  },
  neutral: {
    icon: <Minus className="h-3.5 w-3.5" />,
    color: "text-text-muted",
  },
};

export function StatsCard({
  label,
  value,
  trend,
  trendValue,
  period,
  icon,
  className,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border-default bg-bg-secondary p-5 transition-all duration-200 hover:border-border-subtle",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-text-muted">{label}</p>
          <p className="text-2xl font-bold text-text-primary">{value}</p>
        </div>
        {icon && (
          <div className="rounded-lg bg-accent-blue/10 p-2.5 text-accent-blue">
            {icon}
          </div>
        )}
      </div>
      {(trend || period) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {trend && trendValue && (
            <span
              className={cn(
                "flex items-center gap-1 font-medium",
                trendConfig[trend].color
              )}
            >
              {trendConfig[trend].icon}
              {trendValue}
            </span>
          )}
          {period && <span className="text-text-muted">{period}</span>}
        </div>
      )}
    </div>
  );
}

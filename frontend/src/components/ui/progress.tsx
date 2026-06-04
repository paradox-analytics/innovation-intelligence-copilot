import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  max?: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  color?: "blue" | "emerald" | "amber" | "rose" | "cyan" | "violet";
  className?: string;
}

const sizeStyles: Record<string, string> = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
};

const colorStyles: Record<string, string> = {
  blue: "bg-accent-blue",
  emerald: "bg-accent-emerald",
  amber: "bg-accent-amber",
  rose: "bg-accent-rose",
  cyan: "bg-accent-cyan",
  violet: "bg-accent-violet",
};

export function Progress({
  value,
  max = 100,
  showLabel = false,
  size = "md",
  color = "blue",
  className,
}: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="mb-1 flex items-center justify-between text-xs text-text-muted">
          <span>Progress</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div
        className={cn(
          "w-full overflow-hidden rounded-full bg-bg-tertiary",
          sizeStyles[size]
        )}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            colorStyles[color]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

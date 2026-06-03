import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type BadgeVariant =
  | "default"
  | "blue"
  | "cyan"
  | "emerald"
  | "amber"
  | "rose"
  | "violet";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-bg-tertiary text-text-secondary border-border-default",
  blue: "bg-accent-blue/15 text-accent-blue border-accent-blue/30",
  cyan: "bg-accent-cyan/15 text-accent-cyan border-accent-cyan/30",
  emerald: "bg-accent-emerald/15 text-accent-emerald border-accent-emerald/30",
  amber: "bg-accent-amber/15 text-accent-amber border-accent-amber/30",
  rose: "bg-accent-rose/15 text-accent-rose border-accent-rose/30",
  violet: "bg-accent-violet/15 text-accent-violet border-accent-violet/30",
};

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge, type BadgeProps, type BadgeVariant };

"use client";

import { cn } from "@/lib/utils";
import { ChevronDown, Info } from "lucide-react";
import { useState, type ReactNode } from "react";

interface HowItWorksProps {
  title?: string;
  children: ReactNode;
  className?: string;
  /** Start collapsed. Defaults to open. */
  defaultOpen?: boolean;
}

/** A subtle, collapsible "how it works" explainer panel. */
export function HowItWorks({
  title = "How it works",
  children,
  className,
  defaultOpen = true,
}: HowItWorksProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={cn(
        "rounded-lg border border-border-default bg-bg-secondary/40 px-4 py-3",
        className
      )}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={open}
      >
        <Info className="h-4 w-4 shrink-0 text-accent-blue" />
        <span className="text-sm font-semibold text-text-primary">{title}</span>
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 text-text-muted transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-text-secondary">
          {children}
        </div>
      )}
    </div>
  );
}

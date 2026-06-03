"use client";

import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className,
}: ToggleProps) {
  return (
    <label
      className={cn(
        "flex items-center gap-3 cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary",
          checked ? "bg-accent-blue" : "bg-bg-tertiary"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className="text-sm font-medium text-text-primary">
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-text-muted">{description}</span>
          )}
        </div>
      )}
    </label>
  );
}

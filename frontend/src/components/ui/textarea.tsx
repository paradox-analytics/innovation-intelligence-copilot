import { cn } from "@/lib/utils";
import { forwardRef, type TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  showCount?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, showCount, maxLength, value, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const currentLength = typeof value === "string" ? value.length : 0;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-text-secondary"
          >
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          value={value}
          maxLength={maxLength}
          className={cn(
            "flex min-h-[80px] w-full resize-y rounded-md border bg-bg-tertiary px-3 py-2 text-sm text-text-primary",
            "placeholder:text-text-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "transition-colors duration-200",
            error
              ? "border-accent-rose focus-visible:ring-accent-rose"
              : "border-border-default hover:border-border-subtle",
            className
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${textareaId}-error` : undefined}
          {...props}
        />
        <div className="flex items-center justify-between">
          {error ? (
            <p
              id={`${textareaId}-error`}
              className="text-xs text-accent-rose"
              role="alert"
            >
              {error}
            </p>
          ) : (
            <span />
          )}
          {showCount && maxLength && (
            <span className="text-xs text-text-muted">
              {currentLength}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

export { Textarea, type TextareaProps };

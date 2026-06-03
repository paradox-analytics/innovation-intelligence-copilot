"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, type ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

interface DialogHeaderProps {
  children: ReactNode;
  className?: string;
}

interface DialogTitleProps {
  children: ReactNode;
  className?: string;
}

interface DialogBodyProps {
  children: ReactNode;
  className?: string;
}

interface DialogFooterProps {
  children: ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, children, className }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 mx-4 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border-default bg-bg-secondary shadow-2xl animate-fade-in",
          className
        )}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ children, className }: DialogHeaderProps) {
  return (
    <div className={cn("px-6 pt-6 pb-2", className)}>{children}</div>
  );
}

export function DialogTitle({ children, className }: DialogTitleProps) {
  return (
    <h2
      className={cn(
        "text-lg font-semibold text-text-primary",
        className
      )}
    >
      {children}
    </h2>
  );
}

export function DialogBody({ children, className }: DialogBodyProps) {
  return <div className={cn("px-6 py-4", className)}>{children}</div>;
}

export function DialogFooter({ children, className }: DialogFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 border-t border-border-default px-6 py-4",
        className
      )}
    >
      {children}
    </div>
  );
}

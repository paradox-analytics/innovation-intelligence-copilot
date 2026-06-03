"use client";

import { cn } from "@/lib/utils";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface DropdownItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface DropdownProps {
  trigger: ReactNode;
  items: (DropdownItem | "separator")[];
  align?: "left" | "right";
  className?: string;
}

export function Dropdown({
  trigger,
  items,
  align = "left",
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const actionableItems = items.filter(
    (item): item is DropdownItem => item !== "separator"
  );

  const close = useCallback(() => {
    setOpen(false);
    setFocusIndex(-1);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [close]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        setFocusIndex(0);
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "ArrowDown":
        e.preventDefault();
        setFocusIndex((prev) =>
          prev < actionableItems.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusIndex((prev) =>
          prev > 0 ? prev - 1 : actionableItems.length - 1
        );
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusIndex >= 0 && focusIndex < actionableItems.length) {
          const item = actionableItems[focusIndex];
          if (!item.disabled) {
            item.onClick();
            close();
          }
        }
        break;
    }
  };

  let actionIndex = -1;

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block", className)}
      onKeyDown={handleKeyDown}
    >
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div
          ref={menuRef}
          className={cn(
            "absolute z-50 mt-1 min-w-[180px] rounded-lg border border-border-default bg-bg-elevated py-1 shadow-xl animate-fade-in",
            align === "right" ? "right-0" : "left-0"
          )}
          role="menu"
        >
          {items.map((item, i) => {
            if (item === "separator") {
              return (
                <div
                  key={`sep-${i}`}
                  className="my-1 border-t border-border-default"
                  role="separator"
                />
              );
            }

            actionIndex++;
            const currentIndex = actionIndex;
            const isFocused = focusIndex === currentIndex;

            return (
              <button
                key={item.label}
                role="menuitem"
                disabled={item.disabled}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                  item.danger
                    ? "text-accent-rose hover:bg-accent-rose/10"
                    : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                  isFocused && (item.danger ? "bg-accent-rose/10" : "bg-bg-hover text-text-primary"),
                  item.disabled && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => {
                  if (!item.disabled) {
                    item.onClick();
                    close();
                  }
                }}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

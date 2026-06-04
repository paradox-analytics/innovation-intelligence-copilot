"use client";

import { cn } from "@/lib/utils";
import {
  Brain,
  FileText,
  Network,
  Search,
  Settings,
  BarChart3,
  LayoutDashboard,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: ReactNode;
  action: () => void;
  category: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const commands: CommandItem[] = useMemo(
    () => [
      {
        id: "dashboard",
        label: "Dashboard",
        description: "Go to dashboard home",
        icon: <LayoutDashboard className="h-4 w-4" />,
        action: () => router.push("/dashboard"),
        category: "Navigation",
      },
      {
        id: "analyze",
        label: "New Analysis",
        description: "Start a strategic analysis",
        icon: <Search className="h-4 w-4" />,
        action: () => router.push("/analyze"),
        category: "Navigation",
      },
      {
        id: "documents",
        label: "Documents",
        description: "Manage uploaded documents",
        icon: <FileText className="h-4 w-4" />,
        action: () => router.push("/documents"),
        category: "Navigation",
      },
      {
        id: "knowledge",
        label: "Knowledge Graph",
        description: "Explore entity relationships",
        icon: <Network className="h-4 w-4" />,
        action: () => router.push("/knowledge"),
        category: "Navigation",
      },
      {
        id: "reports",
        label: "Reports",
        description: "View generated reports",
        icon: <Brain className="h-4 w-4" />,
        action: () => router.push("/reports"),
        category: "Navigation",
      },
      {
        id: "analytics",
        label: "Analytics",
        description: "View usage analytics",
        icon: <BarChart3 className="h-4 w-4" />,
        action: () => router.push("/dashboard"),
        category: "Navigation",
      },
      {
        id: "settings",
        label: "Settings",
        description: "Manage API keys and preferences",
        icon: <Settings className="h-4 w-4" />,
        action: () => router.push("/settings"),
        category: "Navigation",
      },
    ],
    [router]
  );

  const filteredCommands = useMemo(() => {
    if (!query) return commands;
    const lower = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lower) ||
        cmd.description?.toLowerCase().includes(lower) ||
        cmd.category.toLowerCase().includes(lower)
    );
  }, [commands, query]);

  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const cmd of filteredCommands) {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    }
    return groups;
  }, [filteredCommands]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          close();
        }
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
    }
  };

  if (!open) return null;

  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-border-default bg-bg-secondary shadow-2xl animate-fade-in"
        role="dialog"
        aria-label="Command palette"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border-default px-4 py-3">
          <Search className="h-5 w-5 text-text-muted" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <kbd className="rounded border border-border-default bg-bg-tertiary px-1.5 py-0.5 text-xs text-text-muted">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto py-2">
          {Object.entries(groupedCommands).map(([category, items]) => (
            <div key={category}>
              <div className="px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-text-muted">
                {category}
              </div>
              {items.map((cmd) => {
                flatIndex++;
                const isSelected = flatIndex === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      isSelected
                        ? "bg-accent-blue/10 text-accent-blue"
                        : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                    )}
                    onClick={() => {
                      cmd.action();
                      close();
                    }}
                  >
                    {cmd.icon}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{cmd.label}</p>
                      {cmd.description && (
                        <p className="text-xs opacity-70">{cmd.description}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
          {filteredCommands.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-text-muted">
              No commands found
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-border-default px-4 py-2 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border-default bg-bg-tertiary px-1 py-0.5">
              ↑↓
            </kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border-default bg-bg-tertiary px-1 py-0.5">
              ↵
            </kbd>
            Select
          </span>
        </div>
      </div>
    </div>
  );
}

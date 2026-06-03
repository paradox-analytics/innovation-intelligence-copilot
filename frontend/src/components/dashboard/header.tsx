"use client";

import { cn } from "@/lib/utils";
import { Bell, ChevronRight, User } from "lucide-react";
import { usePathname } from "next/navigation";

const pathLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/analyze": "Analysis",
  "/documents": "Documents",
  "/knowledge": "Knowledge Graph",
  "/reports": "Reports",
  "/settings": "Settings",
};

export function Header() {
  const pathname = usePathname();

  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.map((segment, index) => {
    const path = "/" + segments.slice(0, index + 1).join("/");
    return {
      label:
        pathLabels[path] ||
        segment.charAt(0).toUpperCase() + segment.slice(1),
      path,
    };
  });

  return (
    <header className="flex h-16 items-center justify-between border-b border-border-default bg-bg-secondary px-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
        <span className="text-text-muted">Home</span>
        {breadcrumbs.map((crumb) => (
          <span key={crumb.path} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
            <span className="font-medium text-text-primary">
              {crumb.label}
            </span>
          </span>
        ))}
      </nav>

      {/* User area */}
      <div className="flex items-center gap-3">
        <button
          className={cn(
            "relative rounded-lg p-2 text-text-muted transition-colors",
            "hover:bg-bg-hover hover:text-text-secondary"
          )}
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent-blue" />
        </button>
        <div className="flex items-center gap-2 rounded-lg border border-border-default px-3 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-blue/20">
            <User className="h-4 w-4 text-accent-blue" />
          </div>
          <span className="text-sm font-medium text-text-primary">Admin</span>
        </div>
      </div>
    </header>
  );
}

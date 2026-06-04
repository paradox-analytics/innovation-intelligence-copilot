import { cn } from "@/lib/utils";
import {
  Brain,
  FileText,
  Network,
  Search,
  Upload,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";

type ActivityAction =
  | "analysis_started"
  | "analysis_completed"
  | "document_uploaded"
  | "document_deleted"
  | "entity_discovered"
  | "report_generated";

interface ActivityItem {
  id: string;
  action: ActivityAction;
  title: string;
  description?: string;
  timestamp: string;
  user?: string;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  className?: string;
  maxItems?: number;
}

const actionConfig: Record<
  ActivityAction,
  { icon: ReactNode; color: string }
> = {
  analysis_started: {
    icon: <Search className="h-3.5 w-3.5" />,
    color: "bg-accent-blue/15 text-accent-blue",
  },
  analysis_completed: {
    icon: <Brain className="h-3.5 w-3.5" />,
    color: "bg-accent-emerald/15 text-accent-emerald",
  },
  document_uploaded: {
    icon: <Upload className="h-3.5 w-3.5" />,
    color: "bg-accent-violet/15 text-accent-violet",
  },
  document_deleted: {
    icon: <Trash2 className="h-3.5 w-3.5" />,
    color: "bg-accent-rose/15 text-accent-rose",
  },
  entity_discovered: {
    icon: <Network className="h-3.5 w-3.5" />,
    color: "bg-accent-cyan/15 text-accent-cyan",
  },
  report_generated: {
    icon: <FileText className="h-3.5 w-3.5" />,
    color: "bg-accent-amber/15 text-accent-amber",
  },
};

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ActivityFeed({
  items,
  className,
  maxItems = 10,
}: ActivityFeedProps) {
  const displayItems = items.slice(0, maxItems);

  return (
    <div className={cn("space-y-1", className)}>
      {displayItems.map((item, index) => {
        const config = actionConfig[item.action];
        return (
          <div
            key={item.id}
            className={cn(
              "flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-bg-hover",
              index === 0 && "animate-fade-in"
            )}
          >
            <div
              className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                config.color
              )}
            >
              {config.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary truncate">
                {item.title}
              </p>
              {item.description && (
                <p className="text-xs text-text-muted truncate">
                  {item.description}
                </p>
              )}
            </div>
            <span className="shrink-0 text-xs text-text-muted">
              {formatRelativeTime(item.timestamp)}
            </span>
          </div>
        );
      })}
      {displayItems.length === 0 && (
        <div className="py-8 text-center text-sm text-text-muted">
          No recent activity
        </div>
      )}
    </div>
  );
}

export type { ActivityItem, ActivityAction };

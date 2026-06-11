import { Badge } from "@/components/ui/badge";
import type { BadgeVariant } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

interface EvidenceItem {
  id: string;
  claim: string;
  source: string;
  sourceUrl?: string;
  relevance: "high" | "medium" | "low";
  type: "supporting" | "contrarian";
  kind?: "web" | "doc";
}

interface EvidenceListProps {
  items: EvidenceItem[];
  title: string;
  className?: string;
}

const relevanceVariant: Record<EvidenceItem["relevance"], BadgeVariant> = {
  high: "emerald",
  medium: "amber",
  low: "default",
};

export function EvidenceList({ items, title, className }: EvidenceListProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
      {items.length === 0 && (
        <p className="text-sm text-text-muted">No evidence items found.</p>
      )}
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-border-default bg-bg-tertiary p-3 transition-colors hover:border-border-subtle"
          >
            <p className="text-sm text-text-primary leading-relaxed">
              {item.claim}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={relevanceVariant[item.relevance]}>
                  {item.relevance} relevance
                </Badge>
                <span className="text-xs text-text-muted">{item.source}</span>
              </div>
              {item.sourceUrl && (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-accent-blue hover:text-accent-blue-hover transition-colors"
                  aria-label={`Open source: ${item.source}`}
                >
                  <ExternalLink className="h-3 w-3" />
                  Source
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type { EvidenceItem, EvidenceListProps };

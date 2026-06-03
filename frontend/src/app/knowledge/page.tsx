"use client";

import { DashboardLayout } from "@/components/dashboard/layout";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Network, Search } from "lucide-react";
import { useState } from "react";

// --- Types ---

type EntityType = "technology" | "company" | "startup" | "market" | "patent";

interface KnowledgeEntity {
  id: string;
  name: string;
  type: EntityType;
  description: string;
  connections: number;
}

// --- Mock data ---

const entityTypeBadge: Record<EntityType, { variant: BadgeVariant; label: string }> = {
  technology: { variant: "blue", label: "Technology" },
  company: { variant: "emerald", label: "Company" },
  startup: { variant: "violet", label: "Startup" },
  market: { variant: "amber", label: "Market" },
  patent: { variant: "cyan", label: "Patent" },
};

const MOCK_ENTITIES: KnowledgeEntity[] = [
  {
    id: "e1",
    name: "Precision Fermentation",
    type: "technology",
    description:
      "Microbial fermentation technology for producing specific functional ingredients, proteins, and specialty chemicals using engineered microorganisms.",
    connections: 24,
  },
  {
    id: "e2",
    name: "BASF SE",
    type: "company",
    description:
      "German multinational chemical company, world's largest chemical producer. Active in chemicals, plastics, performance products, and agricultural solutions.",
    connections: 18,
  },
  {
    id: "e3",
    name: "Novozymes A/S",
    type: "company",
    description:
      "Danish biotechnology company focused on enzyme production. Merged with Chr. Hansen to form Novonesis in 2024.",
    connections: 15,
  },
  {
    id: "e4",
    name: "Solugen",
    type: "startup",
    description:
      "Houston-based biotech startup using chemoenzymatic processes to produce specialty chemicals from plant-derived feedstocks. Series C, $357M raised.",
    connections: 9,
  },
  {
    id: "e5",
    name: "Bio-Based Chemicals Market",
    type: "market",
    description:
      "Global market for chemicals produced from biological feedstocks. Valued at $98.5B in 2023, projected CAGR 10.2% through 2030.",
    connections: 31,
  },
  {
    id: "e6",
    name: "US11505790B2",
    type: "patent",
    description:
      "Methods for enhanced microbial production of specialty chemicals through synthetic biology pathway engineering. Filed by Ginkgo Bioworks.",
    connections: 7,
  },
  {
    id: "e7",
    name: "Synthetic Biology",
    type: "technology",
    description:
      "Engineering biological systems for novel functions. Enables design of custom metabolic pathways for chemical production.",
    connections: 22,
  },
  {
    id: "e8",
    name: "Ginkgo Bioworks",
    type: "startup",
    description:
      "Cell programming platform company. Designs custom organisms for pharmaceutical, agriculture, and industrial chemical customers.",
    connections: 14,
  },
];

export default function KnowledgePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<EntityType | "all">("all");

  const filteredEntities = MOCK_ENTITIES.filter((entity) => {
    const matchesSearch =
      entity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entity.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === "all" || entity.type === selectedType;
    return matchesSearch && matchesType;
  });

  const typeFilters: Array<{ key: EntityType | "all"; label: string }> = [
    { key: "all", label: "All" },
    { key: "technology", label: "Technology" },
    { key: "company", label: "Company" },
    { key: "startup", label: "Startup" },
    { key: "market", label: "Market" },
    { key: "patent", label: "Patent" },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Knowledge Graph
          </h1>
          <p className="mt-1 text-text-secondary">
            Explore the interconnected intelligence web of technologies,
            companies, and market signals.
          </p>
        </div>

        {/* Graph visualization placeholder */}
        <Card>
          <CardContent className="p-0">
            <div className="flex h-80 flex-col items-center justify-center rounded-lg bg-bg-tertiary">
              <div className="relative">
                {/* Visual placeholder: three concentric rings */}
                <div className="absolute -inset-16 rounded-full border border-dashed border-accent-blue/20" />
                <div className="absolute -inset-10 rounded-full border border-dashed border-accent-blue/30" />
                <div className="absolute -inset-4 rounded-full border border-dashed border-accent-blue/40" />
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-blue/20">
                  <Network className="h-8 w-8 text-accent-blue" />
                </div>
                {/* Mock nodes */}
                <div className="absolute -right-14 -top-8 h-3 w-3 rounded-full bg-accent-emerald" />
                <div className="absolute -left-12 top-2 h-3 w-3 rounded-full bg-accent-violet" />
                <div className="absolute -bottom-10 right-4 h-2.5 w-2.5 rounded-full bg-accent-amber" />
                <div className="absolute -top-14 left-2 h-2 w-2 rounded-full bg-accent-cyan" />
                <div className="absolute -bottom-6 -left-16 h-3 w-3 rounded-full bg-accent-blue" />
              </div>
              <p className="mt-20 text-sm text-text-muted">
                Interactive graph visualization
              </p>
              <p className="text-xs text-text-muted">
                {MOCK_ENTITIES.length} entities --{" "}
                {MOCK_ENTITIES.reduce((sum, e) => sum + e.connections, 0)}{" "}
                connections
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Search and filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search entities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-border-default bg-bg-tertiary py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
            />
          </div>
          <div className="flex gap-1.5">
            {typeFilters.map((filter) => (
              <button
                key={filter.key}
                onClick={() => setSelectedType(filter.key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                  selectedType === filter.key
                    ? "bg-accent-blue text-white"
                    : "bg-bg-tertiary text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Entity list */}
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredEntities.map((entity) => {
            const typeInfo = entityTypeBadge[entity.type];
            return (
              <Card
                key={entity.id}
                className="transition-all duration-200 hover:border-accent-blue/30 hover:shadow-md hover:shadow-accent-blue/5 cursor-pointer"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{entity.name}</CardTitle>
                    <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-text-secondary">
                    {entity.description}
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-text-muted">
                    <Network className="h-3.5 w-3.5" />
                    {entity.connections} connections
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredEntities.length === 0 && (
          <div className="py-12 text-center text-sm text-text-muted">
            No entities found matching your search criteria.
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

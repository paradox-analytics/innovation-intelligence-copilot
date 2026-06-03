"use client";

import { DashboardLayout } from "@/components/dashboard/layout";
import { SignalCard, type SignalCardData } from "@/components/reports/signal-card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  FileText,
  Network,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// --- Types ---

type EntityType = "technology" | "company" | "startup" | "market" | "patent" | "research";

interface KnowledgeEntity {
  id: string;
  name: string;
  type: EntityType;
  description: string;
  connections: number;
  properties?: Record<string, string>;
  relatedDocuments?: string[];
}

interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
}

// --- Mock data ---

const entityTypeConfig: Record<
  EntityType,
  { variant: BadgeVariant; label: string; color: string; fill: string }
> = {
  technology: { variant: "blue", label: "Technology", color: "#3b82f6", fill: "#3b82f620" },
  company: { variant: "emerald", label: "Company", color: "#10b981", fill: "#10b98120" },
  startup: { variant: "violet", label: "Startup", color: "#8b5cf6", fill: "#8b5cf620" },
  market: { variant: "amber", label: "Market", color: "#f59e0b", fill: "#f59e0b20" },
  patent: { variant: "rose", label: "Patent", color: "#f43f5e", fill: "#f43f5e20" },
  research: { variant: "cyan", label: "Research", color: "#06b6d4", fill: "#06b6d420" },
};

const MOCK_ENTITIES: KnowledgeEntity[] = [
  {
    id: "e1",
    name: "Precision Fermentation",
    type: "technology",
    description: "Microbial fermentation technology for producing specific functional ingredients, proteins, and specialty chemicals using engineered microorganisms.",
    connections: 24,
    properties: { "TRL": "6", "Growth Rate": "48.1% CAGR", "Key Driver": "Bio-based transition" },
    relatedDocuments: ["BASF Annual Report 2023", "McKinsey Bio-Revolution Report"],
  },
  {
    id: "e2",
    name: "BASF SE",
    type: "company",
    description: "German multinational chemical company, world's largest chemical producer. Active in chemicals, plastics, performance products, and agricultural solutions.",
    connections: 18,
    properties: { "Revenue": "$87.3B", "Employees": "111,481", "HQ": "Ludwigshafen, Germany" },
    relatedDocuments: ["BASF Annual Report 2023"],
  },
  {
    id: "e3",
    name: "Novozymes A/S",
    type: "company",
    description: "Danish biotechnology company focused on enzyme production. Merged with Chr. Hansen to form Novonesis in 2024.",
    connections: 15,
    properties: { "Revenue": "$2.4B", "Founded": "2000", "Focus": "Industrial enzymes" },
    relatedDocuments: ["Novozymes-DSM Merger Impact Assessment"],
  },
  {
    id: "e4",
    name: "Solugen",
    type: "startup",
    description: "Houston-based biotech startup using chemoenzymatic processes to produce specialty chemicals from plant-derived feedstocks. Series C, $357M raised.",
    connections: 9,
    properties: { "Funding": "$357M", "Stage": "Series C", "Founded": "2016" },
    relatedDocuments: ["Solugen Series C Pitch Deck"],
  },
  {
    id: "e5",
    name: "Bio-Based Chemicals Market",
    type: "market",
    description: "Global market for chemicals produced from biological feedstocks. Valued at $98.5B in 2023, projected CAGR 10.2% through 2030.",
    connections: 31,
    properties: { "Size": "$98.5B", "CAGR": "10.2%", "Horizon": "2030" },
  },
  {
    id: "e6",
    name: "US11505790B2",
    type: "patent",
    description: "Methods for enhanced microbial production of specialty chemicals through synthetic biology pathway engineering. Filed by Ginkgo Bioworks.",
    connections: 7,
    properties: { "Filed By": "Ginkgo Bioworks", "Year": "2023", "Status": "Active" },
  },
  {
    id: "e7",
    name: "Synthetic Biology",
    type: "technology",
    description: "Engineering biological systems for novel functions. Enables design of custom metabolic pathways for chemical production.",
    connections: 22,
    properties: { "TRL": "5-7", "Key Players": "Ginkgo, Zymergen", "Growth": "Strong" },
  },
  {
    id: "e8",
    name: "Ginkgo Bioworks",
    type: "startup",
    description: "Cell programming platform company. Designs custom organisms for pharmaceutical, agriculture, and industrial chemical customers.",
    connections: 14,
    properties: { "Valuation": "$3.5B", "IPO": "2021", "Platform": "Foundry" },
  },
  {
    id: "e9",
    name: "Enzyme Engineering",
    type: "research",
    description: "Directed evolution and rational design of enzymes for industrial applications including chemical synthesis.",
    connections: 16,
    properties: { "Approach": "Directed Evolution", "Nobel Prize": "2018", "Applications": "Industrial" },
  },
  {
    id: "e10",
    name: "Green Chemistry",
    type: "research",
    description: "Design of chemical products and processes that reduce or eliminate hazardous substances, aligned with EU Green Deal objectives.",
    connections: 12,
    properties: { "Principles": "12", "Regulation": "EU REACH", "Trend": "Strong regulatory push" },
  },
];

const MOCK_EDGES: GraphEdge[] = [
  { source: "e1", target: "e2", relationship: "evaluated by" },
  { source: "e1", target: "e5", relationship: "drives" },
  { source: "e1", target: "e7", relationship: "enabled by" },
  { source: "e2", target: "e3", relationship: "competes with" },
  { source: "e2", target: "e5", relationship: "operates in" },
  { source: "e3", target: "e5", relationship: "operates in" },
  { source: "e4", target: "e1", relationship: "applies" },
  { source: "e4", target: "e5", relationship: "targets" },
  { source: "e6", target: "e8", relationship: "filed by" },
  { source: "e6", target: "e7", relationship: "covers" },
  { source: "e7", target: "e8", relationship: "platform" },
  { source: "e7", target: "e9", relationship: "leverages" },
  { source: "e9", target: "e10", relationship: "aligns with" },
  { source: "e10", target: "e5", relationship: "regulates" },
  { source: "e1", target: "e9", relationship: "uses" },
  { source: "e8", target: "e4", relationship: "competes with" },
];

const MOCK_SIGNALS: SignalCardData[] = [
  {
    id: "sig1",
    name: "Precision Fermentation",
    category: "Biotechnology",
    strength: 87,
    trend: "up",
    horizon: "near",
    description: "Rapid advancement in microbial strain engineering enabling cost-competitive production.",
    readinessLevel: 6,
  },
  {
    id: "sig2",
    name: "Synthetic Biology Platforms",
    category: "Biotechnology",
    strength: 72,
    trend: "up",
    horizon: "mid",
    description: "Programmable biology platforms reducing R&D timelines for novel chemical pathways.",
    readinessLevel: 5,
  },
  {
    id: "sig3",
    name: "Carbon Capture Bio-manufacturing",
    category: "Sustainability",
    strength: 41,
    trend: "up",
    horizon: "far",
    description: "Emerging methods using captured CO2 as fermentation feedstock.",
    readinessLevel: 3,
  },
];

// --- Graph simulation ---

interface GraphNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  entity: KnowledgeEntity;
  radius: number;
}

function useForceSimulation(
  entities: KnowledgeEntity[],
  edges: GraphEdge[],
  width: number,
  height: number,
  centeredId: string | null
) {
  const nodesRef = useRef<GraphNode[]>([]);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const frameRef = useRef<number>(0);
  const iterRef = useRef(0);

  useEffect(() => {
    // Initialize nodes in a circle
    const angleStep = (2 * Math.PI) / entities.length;
    const initRadius = Math.min(width, height) * 0.3;
    nodesRef.current = entities.map((entity, i) => ({
      id: entity.id,
      x: width / 2 + Math.cos(angleStep * i) * initRadius + (Math.random() - 0.5) * 20,
      y: height / 2 + Math.sin(angleStep * i) * initRadius + (Math.random() - 0.5) * 20,
      vx: 0,
      vy: 0,
      entity,
      radius: 8 + Math.min(entity.connections, 30) * 0.8,
    }));
    iterRef.current = 0;

    const simulate = () => {
      if (iterRef.current > 300) {
        setNodes([...nodesRef.current]);
        return;
      }
      iterRef.current++;
      const ns = nodesRef.current;
      const alpha = Math.max(0.01, 1 - iterRef.current / 200);

      // Center gravity
      for (const node of ns) {
        const cx = centeredId && node.id === centeredId ? width / 2 : width / 2;
        const cy = centeredId && node.id === centeredId ? height / 2 : height / 2;
        node.vx += (cx - node.x) * 0.01 * alpha;
        node.vy += (cy - node.y) * 0.01 * alpha;
      }

      // Repulsion
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[j].x - ns[i].x;
          const dy = ns[j].y - ns[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (800 * alpha) / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          ns[i].vx -= fx;
          ns[i].vy -= fy;
          ns[j].vx += fx;
          ns[j].vy += fy;
        }
      }

      // Edge attraction
      for (const edge of edges) {
        const source = ns.find((n) => n.id === edge.source);
        const target = ns.find((n) => n.id === edge.target);
        if (!source || !target) continue;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 120) * 0.005 * alpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      }

      // Apply velocity with damping
      for (const node of ns) {
        node.vx *= 0.85;
        node.vy *= 0.85;
        node.x += node.vx;
        node.y += node.vy;
        // Bounds
        node.x = Math.max(node.radius + 10, Math.min(width - node.radius - 10, node.x));
        node.y = Math.max(node.radius + 10, Math.min(height - node.radius - 10, node.y));
      }

      setNodes([...ns]);
      frameRef.current = requestAnimationFrame(simulate);
    };

    frameRef.current = requestAnimationFrame(simulate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [entities, edges, width, height, centeredId]);

  return nodes;
}

// --- Page component ---

export default function KnowledgePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<EntityType | "all">("all");
  const [selectedEntity, setSelectedEntity] = useState<KnowledgeEntity | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [centeredNode, setCenteredNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const graphWidth = 800;
  const graphHeight = 500;

  const nodes = useForceSimulation(MOCK_ENTITIES, MOCK_EDGES, graphWidth, graphHeight, centeredNode);

  const filteredEntities = MOCK_ENTITIES.filter((entity) => {
    const matchesSearch =
      entity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entity.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === "all" || entity.type === selectedType;
    return matchesSearch && matchesType;
  });

  const autocompleteResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    return MOCK_ENTITIES.filter((e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5);
  }, [searchQuery]);

  const handleNodeClick = useCallback((entity: KnowledgeEntity) => {
    setSelectedEntity(entity);
    setCenteredNode(entity.id);
    setDetailPanelOpen(true);
  }, []);

  const handleAutocompleteSelect = (entity: KnowledgeEntity) => {
    setSearchQuery(entity.name);
    setAutocompleteOpen(false);
    handleNodeClick(entity);
  };

  const getConnectedEdges = (entityId: string) => {
    return MOCK_EDGES.filter(
      (e) => e.source === entityId || e.target === entityId
    );
  };

  const typeFilters: Array<{ key: EntityType | "all"; label: string }> = [
    { key: "all", label: "All" },
    { key: "technology", label: "Technology" },
    { key: "company", label: "Company" },
    { key: "startup", label: "Startup" },
    { key: "market", label: "Market" },
    { key: "patent", label: "Patent" },
    { key: "research", label: "Research" },
  ];

  return (
    <DashboardLayout>
      <div className="flex h-full">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl space-y-6 p-6">
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

            {/* Graph visualization */}
            <Card className="overflow-hidden">
              <CardContent className="p-0 relative">
                {/* Zoom controls */}
                <div className="absolute right-4 top-4 z-10 flex flex-col gap-1">
                  <button
                    onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
                    className="rounded-md border border-border-default bg-bg-secondary p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                    aria-label="Zoom in"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
                    className="rounded-md border border-border-default bg-bg-secondary p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                    aria-label="Zoom out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { setZoom(1); setCenteredNode(null); }}
                    className="rounded-md border border-border-default bg-bg-secondary p-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                    aria-label="Reset view"
                  >
                    1:1
                  </button>
                </div>

                {/* Legend */}
                <div className="absolute left-4 bottom-4 z-10 flex flex-wrap gap-2">
                  {Object.entries(entityTypeConfig).map(([type, config]) => (
                    <div key={type} className="flex items-center gap-1.5">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: config.color }}
                      />
                      <span className="text-[10px] text-text-muted">{config.label}</span>
                    </div>
                  ))}
                </div>

                <div className="overflow-hidden rounded-lg bg-bg-tertiary" style={{ height: graphHeight }}>
                  <svg
                    width="100%"
                    height="100%"
                    viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                    className="transition-transform duration-300"
                    style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                  >
                    {/* Edges */}
                    {MOCK_EDGES.map((edge, i) => {
                      const sourceNode = nodes.find((n) => n.id === edge.source);
                      const targetNode = nodes.find((n) => n.id === edge.target);
                      if (!sourceNode || !targetNode) return null;

                      const isHighlighted =
                        hoveredNode === edge.source ||
                        hoveredNode === edge.target ||
                        centeredNode === edge.source ||
                        centeredNode === edge.target;

                      return (
                        <g key={`edge-${i}`}>
                          <line
                            x1={sourceNode.x}
                            y1={sourceNode.y}
                            x2={targetNode.x}
                            y2={targetNode.y}
                            stroke={isHighlighted ? "#3b82f680" : "#334155"}
                            strokeWidth={isHighlighted ? 2 : 1}
                            className="transition-all duration-300"
                          />
                          {isHighlighted && (
                            <text
                              x={(sourceNode.x + targetNode.x) / 2}
                              y={(sourceNode.y + targetNode.y) / 2 - 6}
                              textAnchor="middle"
                              className="text-[9px] fill-text-muted"
                            >
                              {edge.relationship}
                            </text>
                          )}
                        </g>
                      );
                    })}

                    {/* Nodes */}
                    {nodes.map((node) => {
                      const config = entityTypeConfig[node.entity.type];
                      const isHovered = hoveredNode === node.id;
                      const isCentered = centeredNode === node.id;
                      const isConnected =
                        hoveredNode !== null &&
                        MOCK_EDGES.some(
                          (e) =>
                            (e.source === hoveredNode && e.target === node.id) ||
                            (e.target === hoveredNode && e.source === node.id)
                        );
                      const dimmed = hoveredNode !== null && !isHovered && !isConnected;

                      return (
                        <g
                          key={node.id}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredNode(node.id)}
                          onMouseLeave={() => setHoveredNode(null)}
                          onClick={() => handleNodeClick(node.entity)}
                        >
                          {/* Glow ring for centered */}
                          {isCentered && (
                            <circle
                              cx={node.x}
                              cy={node.y}
                              r={node.radius + 8}
                              fill="none"
                              stroke={config.color}
                              strokeWidth={2}
                              opacity={0.4}
                              className="animate-pulse-subtle"
                            />
                          )}
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={isHovered ? node.radius + 3 : node.radius}
                            fill={config.fill}
                            stroke={config.color}
                            strokeWidth={isHovered || isCentered ? 2.5 : 1.5}
                            opacity={dimmed ? 0.3 : 1}
                            className="transition-all duration-200"
                          />
                          <text
                            x={node.x}
                            y={node.y + node.radius + 14}
                            textAnchor="middle"
                            className="text-[10px] font-medium"
                            fill={dimmed ? "#64748b60" : "#94a3b8"}
                          >
                            {node.entity.name.length > 18
                              ? node.entity.name.slice(0, 16) + "..."
                              : node.entity.name}
                          </text>

                          {/* Tooltip on hover */}
                          {isHovered && (
                            <g>
                              <rect
                                x={node.x - 80}
                                y={node.y - node.radius - 40}
                                width={160}
                                height={28}
                                rx={4}
                                fill="#1e293b"
                                stroke="#334155"
                              />
                              <text
                                x={node.x}
                                y={node.y - node.radius - 22}
                                textAnchor="middle"
                                className="text-[10px]"
                                fill="#f1f5f9"
                              >
                                {node.entity.name} ({node.entity.connections} conn.)
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>

                <div className="flex items-center justify-between border-t border-border-default px-4 py-2 text-xs text-text-muted">
                  <span>
                    {MOCK_ENTITIES.length} entities -- {MOCK_EDGES.length} connections
                  </span>
                  <span>Click a node to explore its connections</span>
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
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setAutocompleteOpen(e.target.value.length >= 2);
                  }}
                  onFocus={() => searchQuery.length >= 2 && setAutocompleteOpen(true)}
                  onBlur={() => setTimeout(() => setAutocompleteOpen(false), 200)}
                  className="w-full rounded-md border border-border-default bg-bg-tertiary py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
                />
                {/* Autocomplete dropdown */}
                {autocompleteOpen && autocompleteResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-lg border border-border-default bg-bg-elevated py-1 shadow-xl">
                    {autocompleteResults.map((entity) => {
                      const config = entityTypeConfig[entity.type];
                      return (
                        <button
                          key={entity.id}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-bg-hover transition-colors"
                          onMouseDown={() => handleAutocompleteSelect(entity)}
                        >
                          <div
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: config.color }}
                          />
                          <span className="text-text-primary">{entity.name}</span>
                          <Badge variant={config.variant} className="ml-auto text-[10px]">
                            {config.label}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
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

            {/* Technology Signals Dashboard */}
            <div>
              <h2 className="mb-4 text-lg font-semibold text-text-primary">
                Technology Signals
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {MOCK_SIGNALS.map((signal) => (
                  <SignalCard key={signal.id} signal={signal} />
                ))}
              </div>
            </div>

            {/* Entity list */}
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredEntities.map((entity) => {
                const typeInfo = entityTypeConfig[entity.type];
                return (
                  <Card
                    key={entity.id}
                    className="transition-all duration-200 hover:border-accent-blue/30 hover:shadow-md hover:shadow-accent-blue/5 cursor-pointer"
                    onClick={() => handleNodeClick(entity)}
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
        </div>

        {/* Entity Detail Panel */}
        {detailPanelOpen && selectedEntity && (
          <div className="w-80 shrink-0 border-l border-border-default bg-bg-secondary overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between border-b border-border-default p-4">
              <h3 className="text-sm font-semibold text-text-primary">
                Entity Details
              </h3>
              <button
                onClick={() => {
                  setDetailPanelOpen(false);
                  setCenteredNode(null);
                }}
                className="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary"
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-4">
              {/* Entity name and type */}
              <div>
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{
                      backgroundColor: entityTypeConfig[selectedEntity.type].color,
                    }}
                  />
                  <Badge variant={entityTypeConfig[selectedEntity.type].variant}>
                    {entityTypeConfig[selectedEntity.type].label}
                  </Badge>
                </div>
                <h4 className="mt-2 text-lg font-semibold text-text-primary">
                  {selectedEntity.name}
                </h4>
              </div>

              {/* Description */}
              <p className="text-sm leading-relaxed text-text-secondary">
                {selectedEntity.description}
              </p>

              {/* Properties */}
              {selectedEntity.properties && (
                <div className="space-y-2">
                  <h5 className="text-xs font-medium uppercase text-text-muted">
                    Properties
                  </h5>
                  <div className="space-y-1.5">
                    {Object.entries(selectedEntity.properties).map(
                      ([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between rounded bg-bg-tertiary px-3 py-1.5 text-xs"
                        >
                          <span className="text-text-muted">{key}</span>
                          <span className="font-medium text-text-primary">
                            {value}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Connections */}
              <div className="space-y-2">
                <h5 className="text-xs font-medium uppercase text-text-muted">
                  Relationships ({getConnectedEdges(selectedEntity.id).length})
                </h5>
                <div className="space-y-1.5">
                  {getConnectedEdges(selectedEntity.id).map((edge, i) => {
                    const otherId =
                      edge.source === selectedEntity.id
                        ? edge.target
                        : edge.source;
                    const other = MOCK_ENTITIES.find((e) => e.id === otherId);
                    if (!other) return null;
                    return (
                      <button
                        key={i}
                        className="flex w-full items-center gap-2 rounded bg-bg-tertiary px-3 py-2 text-left text-xs transition-colors hover:bg-bg-hover"
                        onClick={() => handleNodeClick(other)}
                      >
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor:
                              entityTypeConfig[other.type].color,
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-text-primary truncate">
                            {other.name}
                          </p>
                          <p className="text-text-muted">{edge.relationship}</p>
                        </div>
                        <ChevronRight className="h-3 w-3 text-text-muted" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Related Documents */}
              {selectedEntity.relatedDocuments &&
                selectedEntity.relatedDocuments.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-xs font-medium uppercase text-text-muted">
                      Related Documents
                    </h5>
                    <div className="space-y-1.5">
                      {selectedEntity.relatedDocuments.map((doc, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded bg-bg-tertiary px-3 py-2 text-xs"
                        >
                          <FileText className="h-3.5 w-3.5 text-text-muted" />
                          <span className="text-text-secondary">{doc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

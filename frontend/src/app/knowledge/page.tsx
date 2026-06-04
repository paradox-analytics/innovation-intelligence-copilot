"use client";

import { DashboardLayout } from "@/components/dashboard/layout";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  apiClient,
  type EntityResponse,
  type RelationshipResponse,
} from "@/lib/api";
import {
  ChevronRight,
  Loader2,
  Network,
  Search,
  X,
  ZoomIn,
  ZoomOut,
  AlertCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// --- Types ---

type EntityType =
  | "technology"
  | "company"
  | "startup"
  | "market"
  | "patent"
  | "research"
  | string;

interface DisplayEntity {
  id: string;
  name: string;
  type: EntityType;
  description: string;
  connections: number;
  properties?: Record<string, string>;
}

interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
}

// --- Config ---

const entityTypeConfig: Record<
  string,
  { variant: BadgeVariant; label: string; color: string; fill: string }
> = {
  technology: {
    variant: "blue",
    label: "Technology",
    color: "#3b82f6",
    fill: "#3b82f620",
  },
  company: {
    variant: "emerald",
    label: "Company",
    color: "#10b981",
    fill: "#10b98120",
  },
  startup: {
    variant: "violet",
    label: "Startup",
    color: "#8b5cf6",
    fill: "#8b5cf620",
  },
  market: {
    variant: "amber",
    label: "Market",
    color: "#f59e0b",
    fill: "#f59e0b20",
  },
  patent: {
    variant: "rose",
    label: "Patent",
    color: "#f43f5e",
    fill: "#f43f5e20",
  },
  research: {
    variant: "cyan",
    label: "Research",
    color: "#06b6d4",
    fill: "#06b6d420",
  },
};

function getEntityConfig(type: string) {
  return (
    entityTypeConfig[type.toLowerCase()] || {
      variant: "default" as BadgeVariant,
      label: type,
      color: "#94a3b8",
      fill: "#94a3b820",
    }
  );
}

// --- Graph simulation ---

interface GraphNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  entity: DisplayEntity;
  radius: number;
}

function useForceSimulation(
  entities: DisplayEntity[],
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
    if (entities.length === 0) {
      setNodes([]);
      return;
    }

    // Initialize nodes in a circle
    const angleStep = (2 * Math.PI) / entities.length;
    const initRadius = Math.min(width, height) * 0.3;
    nodesRef.current = entities.map((entity, i) => ({
      id: entity.id,
      x:
        width / 2 +
        Math.cos(angleStep * i) * initRadius +
        (Math.random() - 0.5) * 20,
      y:
        height / 2 +
        Math.sin(angleStep * i) * initRadius +
        (Math.random() - 0.5) * 20,
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
        node.vx += (width / 2 - node.x) * 0.01 * alpha;
        node.vy += (height / 2 - node.y) * 0.01 * alpha;
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
        node.x = Math.max(
          node.radius + 10,
          Math.min(width - node.radius - 10, node.x)
        );
        node.y = Math.max(
          node.radius + 10,
          Math.min(height - node.radius - 10, node.y)
        );
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
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedEntity, setSelectedEntity] = useState<DisplayEntity | null>(
    null
  );
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [centeredNode, setCenteredNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);

  // Data state
  const [entities, setEntities] = useState<DisplayEntity[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [, setRelationships] = useState<RelationshipResponse[]>([]);
  const [totalEntities, setTotalEntities] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingRelationships, setLoadingRelationships] = useState(false);

  const graphWidth = 800;
  const graphHeight = 500;

  // Fetch entities from API
  const fetchEntities = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const response = await apiClient.listEntities({ limit: 100 });
      const displayEntities: DisplayEntity[] = response.data.map(
        (e: EntityResponse) => ({
          id: e.id,
          name: e.name,
          type: e.entity_type.toLowerCase(),
          description: "",
          connections: 0,
          properties: e.properties
            ? Object.fromEntries(
                Object.entries(e.properties).map(([k, v]) => [k, String(v)])
              )
            : undefined,
        })
      );
      setEntities(displayEntities);
      setTotalEntities(response.total);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load entities"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  // Fetch relationships when entity is clicked
  const fetchRelationships = useCallback(
    async (entity: DisplayEntity) => {
      setLoadingRelationships(true);
      try {
        const response = await apiClient.getEntityRelationships(entity.id);
        setRelationships(response.relationships);

        // Convert to graph edges
        const newEdges: GraphEdge[] = response.relationships.map((r) => ({
          source: r.source_entity_id,
          target: r.target_entity_id,
          relationship: r.relationship_type,
        }));
        setEdges((prev) => {
          // Merge, avoiding duplicates
          const existing = new Set(
            prev.map((e) => `${e.source}-${e.target}-${e.relationship}`)
          );
          const unique = newEdges.filter(
            (e) => !existing.has(`${e.source}-${e.target}-${e.relationship}`)
          );
          return [...prev, ...unique];
        });

        // Update connection count
        setEntities((prev) =>
          prev.map((e) =>
            e.id === entity.id
              ? {
                  ...e,
                  connections: response.relationships.length,
                  description:
                    response.entity.properties?.description
                      ? String(response.entity.properties.description)
                      : e.description,
                }
              : e
          )
        );
      } catch (err) {
        console.error("Failed to fetch relationships:", err);
      } finally {
        setLoadingRelationships(false);
      }
    },
    []
  );

  const nodes = useForceSimulation(
    entities,
    edges,
    graphWidth,
    graphHeight,
    centeredNode
  );

  const filteredEntities = entities.filter((entity) => {
    const matchesSearch =
      entity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entity.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      selectedType === "all" || entity.type === selectedType;
    return matchesSearch && matchesType;
  });

  const autocompleteResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    return entities
      .filter((e) => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .slice(0, 5);
  }, [searchQuery, entities]);

  const handleNodeClick = useCallback(
    (entity: DisplayEntity) => {
      setSelectedEntity(entity);
      setCenteredNode(entity.id);
      setDetailPanelOpen(true);
      fetchRelationships(entity);
    },
    [fetchRelationships]
  );

  const handleAutocompleteSelect = (entity: DisplayEntity) => {
    setSearchQuery(entity.name);
    setAutocompleteOpen(false);
    handleNodeClick(entity);
  };

  const getConnectedEdges = (entityId: string) => {
    return edges.filter(
      (e) => e.source === entityId || e.target === entityId
    );
  };

  const typeFilters: Array<{ key: string; label: string }> = [
    { key: "all", label: "All" },
    ...Object.entries(entityTypeConfig).map(([key, config]) => ({
      key,
      label: config.label,
    })),
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

            {/* Loading state */}
            {loading && (
              <Card>
                <CardContent className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
                  <span className="ml-3 text-sm text-text-secondary">
                    Loading knowledge graph...
                  </span>
                </CardContent>
              </Card>
            )}

            {/* Error state */}
            {loadError && (
              <Card className="border-accent-rose/30">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-accent-rose shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        Failed to load knowledge graph
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        {loadError}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={fetchEntities}
                      >
                        Retry
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty state */}
            {!loading && !loadError && entities.length === 0 && (
              <Card>
                <CardContent className="py-16 text-center">
                  <Network className="mx-auto h-12 w-12 text-text-muted/50" />
                  <h3 className="mt-4 text-sm font-semibold text-text-primary">
                    No entities in the knowledge graph yet
                  </h3>
                  <p className="mt-1 text-sm text-text-muted">
                    Ingest documents to populate the knowledge graph with
                    entities and relationships.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Graph visualization */}
            {!loading && entities.length > 0 && (
              <>
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
                        onClick={() => {
                          setZoom(1);
                          setCenteredNode(null);
                        }}
                        className="rounded-md border border-border-default bg-bg-secondary p-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                        aria-label="Reset view"
                      >
                        1:1
                      </button>
                    </div>

                    {/* Legend */}
                    <div className="absolute left-4 bottom-4 z-10 flex flex-wrap gap-2">
                      {Object.entries(entityTypeConfig).map(
                        ([type, config]) => (
                          <div
                            key={type}
                            className="flex items-center gap-1.5"
                          >
                            <div
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: config.color }}
                            />
                            <span className="text-[10px] text-text-muted">
                              {config.label}
                            </span>
                          </div>
                        )
                      )}
                    </div>

                    <div
                      className="overflow-hidden rounded-lg bg-bg-tertiary"
                      style={{ height: graphHeight }}
                    >
                      <svg
                        width="100%"
                        height="100%"
                        viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                        className="transition-transform duration-300"
                        style={{
                          transform: `scale(${zoom})`,
                          transformOrigin: "center center",
                        }}
                      >
                        {/* Edges */}
                        {edges.map((edge, i) => {
                          const sourceNode = nodes.find(
                            (n) => n.id === edge.source
                          );
                          const targetNode = nodes.find(
                            (n) => n.id === edge.target
                          );
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
                                stroke={
                                  isHighlighted ? "#3b82f680" : "#334155"
                                }
                                strokeWidth={isHighlighted ? 2 : 1}
                                className="transition-all duration-300"
                              />
                              {isHighlighted && (
                                <text
                                  x={(sourceNode.x + targetNode.x) / 2}
                                  y={
                                    (sourceNode.y + targetNode.y) / 2 - 6
                                  }
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
                          const config = getEntityConfig(node.entity.type);
                          const isHovered = hoveredNode === node.id;
                          const isCentered = centeredNode === node.id;
                          const isConnected =
                            hoveredNode !== null &&
                            edges.some(
                              (e) =>
                                (e.source === hoveredNode &&
                                  e.target === node.id) ||
                                (e.target === hoveredNode &&
                                  e.source === node.id)
                            );
                          const dimmed =
                            hoveredNode !== null &&
                            !isHovered &&
                            !isConnected;

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
                                r={
                                  isHovered
                                    ? node.radius + 3
                                    : node.radius
                                }
                                fill={config.fill}
                                stroke={config.color}
                                strokeWidth={
                                  isHovered || isCentered ? 2.5 : 1.5
                                }
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
                                    {node.entity.name} (
                                    {node.entity.connections} conn.)
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
                        {totalEntities} entities -- {edges.length} connections
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
                      onFocus={() =>
                        searchQuery.length >= 2 &&
                        setAutocompleteOpen(true)
                      }
                      onBlur={() =>
                        setTimeout(() => setAutocompleteOpen(false), 200)
                      }
                      className="w-full rounded-md border border-border-default bg-bg-tertiary py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
                    />
                    {/* Autocomplete dropdown */}
                    {autocompleteOpen && autocompleteResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-lg border border-border-default bg-bg-elevated py-1 shadow-xl">
                        {autocompleteResults.map((entity) => {
                          const config = getEntityConfig(entity.type);
                          return (
                            <button
                              key={entity.id}
                              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-bg-hover transition-colors"
                              onMouseDown={() =>
                                handleAutocompleteSelect(entity)
                              }
                            >
                              <div
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: config.color }}
                              />
                              <span className="text-text-primary">
                                {entity.name}
                              </span>
                              <Badge
                                variant={config.variant}
                                className="ml-auto text-[10px]"
                              >
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

                {/* Entity list */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {filteredEntities.map((entity) => {
                    const typeInfo = getEntityConfig(entity.type);
                    return (
                      <Card
                        key={entity.id}
                        className="transition-all duration-200 hover:border-accent-blue/30 hover:shadow-md hover:shadow-accent-blue/5 cursor-pointer"
                        onClick={() => handleNodeClick(entity)}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-base">
                              {entity.name}
                            </CardTitle>
                            <Badge variant={typeInfo.variant}>
                              {typeInfo.label}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {entity.description && (
                            <p className="text-sm leading-relaxed text-text-secondary">
                              {entity.description}
                            </p>
                          )}
                          <div className="mt-3 flex items-center gap-1.5 text-xs text-text-muted">
                            <Network className="h-3.5 w-3.5" />
                            {entity.connections} connections
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {filteredEntities.length === 0 && entities.length > 0 && (
                  <div className="py-12 text-center text-sm text-text-muted">
                    No entities found matching your search criteria.
                  </div>
                )}
              </>
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
                      backgroundColor: getEntityConfig(selectedEntity.type)
                        .color,
                    }}
                  />
                  <Badge variant={getEntityConfig(selectedEntity.type).variant}>
                    {getEntityConfig(selectedEntity.type).label}
                  </Badge>
                </div>
                <h4 className="mt-2 text-lg font-semibold text-text-primary">
                  {selectedEntity.name}
                </h4>
              </div>

              {/* Description */}
              {selectedEntity.description && (
                <p className="text-sm leading-relaxed text-text-secondary">
                  {selectedEntity.description}
                </p>
              )}

              {/* Properties */}
              {selectedEntity.properties &&
                Object.keys(selectedEntity.properties).filter(
                  (k) => !k.startsWith("source_document") && k !== "id"
                ).length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-xs font-medium uppercase text-text-muted">
                      Properties
                    </h5>
                    <div className="space-y-1.5">
                      {Object.entries(selectedEntity.properties)
                        .filter(([key]) => !key.startsWith("source_document") && key !== "id")
                        .map(([key, value]) => (
                          <div
                            key={key}
                            className="flex items-start justify-between gap-3 rounded bg-bg-tertiary px-3 py-1.5 text-xs"
                          >
                            <span className="shrink-0 text-text-muted">
                              {key.replace(/_/g, " ")}
                            </span>
                            <span className="font-medium text-text-primary text-right break-words min-w-0">
                              {String(value).length > 60 ? `${String(value).slice(0, 60)}...` : value}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

              {/* Connections */}
              <div className="space-y-2">
                <h5 className="text-xs font-medium uppercase text-text-muted">
                  Relationships (
                  {loadingRelationships ? (
                    <Loader2 className="inline h-3 w-3 animate-spin" />
                  ) : (
                    getConnectedEdges(selectedEntity.id).length
                  )}
                  )
                </h5>
                {loadingRelationships ? (
                  <div className="flex items-center gap-2 py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
                    <span className="text-xs text-text-muted">
                      Loading relationships...
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {getConnectedEdges(selectedEntity.id).map((edge, i) => {
                      const otherId =
                        edge.source === selectedEntity.id
                          ? edge.target
                          : edge.source;
                      const other = entities.find((e) => e.id === otherId);
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
                              backgroundColor: getEntityConfig(other.type)
                                .color,
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-text-primary truncate">
                              {other.name}
                            </p>
                            <p className="text-text-muted">
                              {edge.relationship}
                            </p>
                          </div>
                          <ChevronRight className="h-3 w-3 text-text-muted" />
                        </button>
                      );
                    })}
                    {getConnectedEdges(selectedEntity.id).length === 0 &&
                      !loadingRelationships && (
                        <p className="text-xs text-text-muted py-2">
                          No relationships found for this entity.
                        </p>
                      )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

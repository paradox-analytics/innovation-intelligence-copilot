"use client";

import { DashboardLayout } from "@/components/dashboard/layout";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import {
  AlertCircle,
  Brain,
  ChevronRight,
  FileText,
  Network,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

// --- Helpers ---

function getRecommendationLabel(confidence: number | null): {
  label: string;
  variant: "emerald" | "amber" | "rose" | "default";
} {
  if (confidence === null) return { label: "Pending", variant: "default" };
  // Normalize: if <= 1, treat as fraction
  const score = confidence <= 1 ? confidence * 100 : confidence;
  if (score >= 70) return { label: "Proceed", variant: "emerald" };
  if (score >= 50) return { label: "Caution", variant: "amber" };
  return { label: "Avoid", variant: "rose" };
}

function normalizeScore(score: number | null): number {
  if (score === null) return 0;
  return score <= 1 ? Math.round(score * 100) : Math.round(score);
}

interface DashboardStats {
  totalAnalyses: number;
  totalDocuments: number;
  totalEntities: number;
}

export default function DashboardPage() {
  const [quickQuery, setQuickQuery] = useState("");
  const [stats, setStats] = useState<DashboardStats>({
    totalAnalyses: 0,
    totalDocuments: 0,
    totalEntities: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch dashboard stats from multiple endpoints
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);

      // Fire all requests in parallel; any that fail return defaults
      const [docsResult, entitiesResult] = await Promise.allSettled([
        apiClient.listDocuments({ limit: 1 }),
        apiClient.listEntities({ limit: 1 }),
      ]);

      const docCount =
        docsResult.status === "fulfilled" ? docsResult.value.total : 0;
      const entityCount =
        entitiesResult.status === "fulfilled"
          ? entitiesResult.value.total
          : 0;

      setStats({
        totalAnalyses: 0, // Backend doesn't have a list analyses endpoint count
        totalDocuments: docCount,
        totalEntities: entityCount,
      });
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load dashboard"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Load saved analyses from localStorage (history)
  const [recentAnalyses, setRecentAnalyses] = useState<
    Array<{
      id: string;
      question: string;
      confidence: number | null;
      date: string;
    }>
  >([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("iic-analyses");
      if (stored) {
        const parsed = JSON.parse(stored) as Array<{
          id: string;
          question: string;
          timestamp: string;
          confidence: number | null;
        }>;
        setRecentAnalyses(
          parsed.slice(0, 5).map((a) => ({
            id: a.id,
            question: a.question,
            confidence: a.confidence,
            date: new Date(a.timestamp).toLocaleDateString(),
          }))
        );
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-8 p-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="mt-1 text-text-secondary">
            Overview of your innovation intelligence workspace.
          </p>
        </div>

        {/* Error state */}
        {loadError && (
          <Card className="border-accent-rose/30">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-accent-rose shrink-0" />
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    Failed to load dashboard data
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {loadError}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={fetchDashboardData}
                  >
                    Retry
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <>
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="skeleton h-4 w-24 mb-2" />
                    <div className="skeleton h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            <>
              <StatsCard
                label="Documents Ingested"
                value={stats.totalDocuments}
                icon={<FileText className="h-5 w-5" />}
              />
              <StatsCard
                label="Entities in Graph"
                value={stats.totalEntities}
                icon={<Network className="h-5 w-5" />}
              />
              <StatsCard
                label="Recent Analyses"
                value={recentAnalyses.length}
                icon={<Brain className="h-5 w-5" />}
              />
            </>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Left column: Quick Analysis + Recent Analyses */}
          <div className="space-y-6 lg:col-span-3">
            {/* Quick Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-5 w-5 text-accent-blue" />
                  Quick Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <input
                      type="text"
                      placeholder="Ask a strategic question..."
                      value={quickQuery}
                      onChange={(e) => setQuickQuery(e.target.value)}
                      className="w-full rounded-md border border-border-default bg-bg-tertiary py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
                    />
                  </div>
                  <Link
                    href={
                      quickQuery
                        ? `/analyze?q=${encodeURIComponent(quickQuery)}`
                        : "/analyze"
                    }
                  >
                    <Button disabled={!quickQuery.trim()}>
                      <Send className="h-4 w-4" />
                      Analyze
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Recent Analyses */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Recent Analyses</CardTitle>
                  <Link
                    href="/reports"
                    className="text-xs text-accent-blue hover:text-accent-blue-hover transition-colors"
                  >
                    View all
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {recentAnalyses.length === 0 ? (
                  <div className="py-8 text-center">
                    <Brain className="mx-auto h-8 w-8 text-text-muted/50" />
                    <p className="mt-2 text-sm text-text-muted">
                      No analyses yet. Start by asking a strategic question.
                    </p>
                    <Link href="/analyze">
                      <Button variant="outline" size="sm" className="mt-3">
                        <Sparkles className="h-4 w-4" />
                        Run Analysis
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentAnalyses.map((analysis) => {
                      const badge = getRecommendationLabel(
                        analysis.confidence
                      );
                      const score = normalizeScore(analysis.confidence);
                      return (
                        <Link
                          key={analysis.id}
                          href={`/analyze?id=${analysis.id}`}
                          className="flex items-center gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-bg-hover group"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-accent-blue">
                            <span className="text-xs font-bold text-accent-blue">{score}%</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-text-primary truncate">
                              {analysis.question}
                            </p>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                              <Badge variant={badge.variant}>
                                {badge.label}
                              </Badge>
                              <span>{analysis.date}</span>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column: Getting Started / Info */}
          <div className="lg:col-span-2">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-base">Getting Started</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Link
                    href="/documents"
                    className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-bg-hover group"
                  >
                    <div className="rounded-lg bg-accent-blue/10 p-2">
                      <FileText className="h-4 w-4 text-accent-blue" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary">
                        Upload Documents
                      </p>
                      <p className="text-xs text-text-muted">
                        Ingest PDFs, reports, and patents
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-text-muted opacity-0 group-hover:opacity-100" />
                  </Link>

                  <Link
                    href="/analyze"
                    className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-bg-hover group"
                  >
                    <div className="rounded-lg bg-accent-violet/10 p-2">
                      <Brain className="h-4 w-4 text-accent-violet" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary">
                        Run Analysis
                      </p>
                      <p className="text-xs text-text-muted">
                        Ask strategic questions with multi-agent AI
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-text-muted opacity-0 group-hover:opacity-100" />
                  </Link>

                  <Link
                    href="/knowledge"
                    className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-bg-hover group"
                  >
                    <div className="rounded-lg bg-accent-emerald/10 p-2">
                      <Network className="h-4 w-4 text-accent-emerald" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary">
                        Explore Knowledge Graph
                      </p>
                      <p className="text-xs text-text-muted">
                        Visualize entity connections
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-text-muted opacity-0 group-hover:opacity-100" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

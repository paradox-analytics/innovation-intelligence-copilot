"use client";

import { DashboardLayout } from "@/components/dashboard/layout";
import {
  ActivityFeed,
  type ActivityItem,
} from "@/components/dashboard/activity-feed";
import { StatsCard } from "@/components/dashboard/stats-card";
import { SignalCard, type SignalCardData } from "@/components/reports/signal-card";
import { ConfidenceGauge } from "@/components/reports/confidence-gauge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Brain,
  ChevronRight,
  FileText,
  Network,
  Search,
  Send,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

// --- Mock data ---

const MOCK_ACTIVITY: ActivityItem[] = [
  {
    id: "act1",
    action: "analysis_completed",
    title: "Analysis completed: BASF fermentation investment",
    description: "73% confidence -- Proceed recommended",
    timestamp: new Date(Date.now() - 1000 * 60 * 23).toISOString(),
    user: "Admin",
  },
  {
    id: "act2",
    action: "document_uploaded",
    title: "McKinsey Bio-Revolution Report uploaded",
    description: "64 pages, 45 entities extracted",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    user: "Admin",
  },
  {
    id: "act3",
    action: "entity_discovered",
    title: "New entity discovered: Carbon Capture Fermentation",
    description: "Technology node added to knowledge graph",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: "act4",
    action: "analysis_started",
    title: "Analysis started: AI drug discovery landscape",
    description: "6 agents deployed",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    user: "Admin",
  },
  {
    id: "act5",
    action: "report_generated",
    title: "Report generated: SE Asia renewable energy",
    description: "81% confidence -- Proceed recommended",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    user: "Admin",
  },
  {
    id: "act6",
    action: "document_uploaded",
    title: "Solugen Series C Pitch Deck uploaded",
    description: "28 pages, processing complete",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    user: "Admin",
  },
];

const RECENT_ANALYSES = [
  {
    id: "a1",
    question: "Should BASF invest in microbial fermentation for specialty chemicals?",
    confidence: 73,
    date: "2024-01-22",
    status: "complete" as const,
  },
  {
    id: "a2",
    question: "AI-powered drug discovery competitive landscape in oncology?",
    confidence: 68,
    date: "2024-01-20",
    status: "complete" as const,
  },
  {
    id: "a3",
    question: "Acquisition of TechStartup Inc. quantum computing portfolio?",
    confidence: 52,
    date: "2024-01-18",
    status: "complete" as const,
  },
  {
    id: "a4",
    question: "Market entry strategy for SE Asian renewable energy?",
    confidence: 81,
    date: "2024-01-15",
    status: "complete" as const,
  },
];

const TOP_SIGNALS: SignalCardData[] = [
  {
    id: "sig1",
    name: "Precision Fermentation",
    category: "Biotechnology",
    strength: 87,
    trend: "up",
    horizon: "near",
    description: "Rapid advancement in microbial strain engineering for cost-competitive production.",
    readinessLevel: 6,
  },
  {
    id: "sig2",
    name: "Synthetic Biology Platforms",
    category: "Biotechnology",
    strength: 72,
    trend: "up",
    horizon: "mid",
    description: "Programmable biology platforms reducing R&D timelines.",
    readinessLevel: 5,
  },
  {
    id: "sig3",
    name: "Quantum Computing Advantage",
    category: "Computing",
    strength: 34,
    trend: "up",
    horizon: "far",
    description: "Approaching practical quantum advantage in molecular simulation.",
    readinessLevel: 3,
  },
];

function getRecommendationLabel(confidence: number): {
  label: string;
  variant: "emerald" | "amber" | "rose";
} {
  if (confidence >= 70) return { label: "Proceed", variant: "emerald" };
  if (confidence >= 50) return { label: "Caution", variant: "amber" };
  return { label: "Avoid", variant: "rose" };
}

export default function DashboardPage() {
  const [quickQuery, setQuickQuery] = useState("");

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

        {/* Stats cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            label="Total Analyses"
            value={24}
            trend="up"
            trendValue="+12%"
            period="vs. last month"
            icon={<Brain className="h-5 w-5" />}
          />
          <StatsCard
            label="Documents Ingested"
            value={142}
            trend="up"
            trendValue="+8"
            period="this week"
            icon={<FileText className="h-5 w-5" />}
          />
          <StatsCard
            label="Entities in Graph"
            value={1247}
            trend="up"
            trendValue="+63"
            period="this month"
            icon={<Network className="h-5 w-5" />}
          />
          <StatsCard
            label="Avg Confidence"
            value="71%"
            trend="neutral"
            trendValue="0%"
            period="vs. last month"
            icon={<TrendingUp className="h-5 w-5" />}
          />
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
                  <Link href={quickQuery ? `/analyze?q=${encodeURIComponent(quickQuery)}` : "/analyze"}>
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
              <CardContent className="space-y-2">
                {RECENT_ANALYSES.map((analysis) => {
                  const badge = getRecommendationLabel(analysis.confidence);
                  return (
                    <Link
                      key={analysis.id}
                      href="/reports"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-bg-hover group"
                    >
                      <ConfidenceGauge
                        score={analysis.confidence}
                        size={40}
                        strokeWidth={3}
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {analysis.question}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          <span>{analysis.date}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  );
                })}
              </CardContent>
            </Card>

            {/* Technology Signals Preview */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-text-primary">
                  Trending Signals
                </h2>
                <Link
                  href="/knowledge"
                  className="text-xs text-accent-blue hover:text-accent-blue-hover transition-colors"
                >
                  View all
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {TOP_SIGNALS.map((signal) => (
                  <SignalCard key={signal.id} signal={signal} />
                ))}
              </div>
            </div>
          </div>

          {/* Right column: Activity Feed */}
          <div className="lg:col-span-2">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-base">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityFeed items={MOCK_ACTIVITY} maxItems={8} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

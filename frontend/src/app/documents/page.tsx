"use client";

import { DashboardLayout } from "@/components/dashboard/layout";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  FileText,
  Loader2,
  Search,
  Trash2,
  Upload,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useCallback, useState } from "react";

// --- Mock data ---

interface MockDocument {
  id: string;
  title: string;
  type: string;
  status: "processing" | "indexed" | "error";
  createdAt: string;
  pageCount: number;
}

const MOCK_DOCUMENTS: MockDocument[] = [
  {
    id: "d1",
    title: "BASF Annual Report 2023",
    type: "PDF",
    status: "indexed",
    createdAt: "2024-01-15",
    pageCount: 248,
  },
  {
    id: "d2",
    title: "McKinsey Bio-Revolution Report",
    type: "PDF",
    status: "indexed",
    createdAt: "2024-01-12",
    pageCount: 64,
  },
  {
    id: "d3",
    title: "Precision Fermentation Market Analysis 2024-2030",
    type: "PDF",
    status: "indexed",
    createdAt: "2024-01-10",
    pageCount: 112,
  },
  {
    id: "d4",
    title: "EU Green Deal Industrial Plan Summary",
    type: "DOCX",
    status: "indexed",
    createdAt: "2024-01-08",
    pageCount: 38,
  },
  {
    id: "d5",
    title: "Novozymes-DSM Merger Impact Assessment",
    type: "PDF",
    status: "processing",
    createdAt: "2024-01-20",
    pageCount: 22,
  },
  {
    id: "d6",
    title: "Internal Strategy Memo - Biotech Expansion",
    type: "PDF",
    status: "error",
    createdAt: "2024-01-18",
    pageCount: 8,
  },
];

const statusConfig: Record<
  MockDocument["status"],
  { variant: BadgeVariant; icon: React.ReactNode; label: string }
> = {
  indexed: {
    variant: "emerald",
    icon: <CheckCircle2 className="h-3 w-3" />,
    label: "Indexed",
  },
  processing: {
    variant: "blue",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    label: "Processing",
  },
  error: {
    variant: "rose",
    icon: <AlertCircle className="h-3 w-3" />,
    label: "Error",
  },
};

export default function DocumentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  const filteredDocs = MOCK_DOCUMENTS.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    // In production, this would handle file upload
  }, []);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Documents</h1>
            <p className="mt-1 text-text-secondary">
              Upload and manage documents for knowledge extraction.
            </p>
          </div>
          <Button>
            <Upload className="h-4 w-4" />
            Upload
          </Button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 transition-all duration-300",
            isDragOver
              ? "border-accent-blue bg-accent-blue/5"
              : "border-border-subtle bg-bg-secondary hover:border-accent-blue/50 hover:bg-bg-secondary/80"
          )}
        >
          <div
            className={cn(
              "rounded-full p-4 transition-colors",
              isDragOver ? "bg-accent-blue/20" : "bg-bg-tertiary"
            )}
          >
            <Upload
              className={cn(
                "h-8 w-8 transition-colors",
                isDragOver ? "text-accent-blue" : "text-text-muted"
              )}
            />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-text-primary">
              Drag & drop files here
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Supports PDF, DOCX, TXT, CSV -- up to 50MB per file
            </p>
          </div>
        </div>

        {/* Document list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Documents ({MOCK_DOCUMENTS.length})
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-border-default bg-bg-tertiary py-1.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-default text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                    <th className="pb-3 pr-4">Title</th>
                    <th className="pb-3 pr-4">Type</th>
                    <th className="pb-3 pr-4">Pages</th>
                    <th className="pb-3 pr-4">Date</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {filteredDocs.map((doc) => {
                    const config = statusConfig[doc.status];
                    return (
                      <tr
                        key={doc.id}
                        className="group transition-colors hover:bg-bg-hover"
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2.5">
                            <FileText className="h-4 w-4 text-text-muted" />
                            <span className="text-sm font-medium text-text-primary">
                              {doc.title}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge>{doc.type}</Badge>
                        </td>
                        <td className="py-3 pr-4 text-sm text-text-secondary">
                          {doc.pageCount}
                        </td>
                        <td className="py-3 pr-4 text-sm text-text-secondary">
                          {doc.createdAt}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={config.variant} className="gap-1">
                            {config.icon}
                            {config.label}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <button
                            className="rounded p-1 text-text-muted opacity-0 transition-all hover:bg-accent-rose/10 hover:text-accent-rose group-hover:opacity-100"
                            aria-label={`Delete ${doc.title}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredDocs.length === 0 && (
                <div className="py-12 text-center text-sm text-text-muted">
                  No documents found matching your search.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

"use client";

import { DashboardLayout } from "@/components/dashboard/layout";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { apiClient, type DocumentResponse } from "@/lib/api";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  FileText,
  Globe,
  Grid3X3,
  Layers,
  List,
  Loader2,
  Search,
  Trash2,
  Upload,
  X,
  SlidersHorizontal,
  ArrowUpDown,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNotifications } from "@/components/notifications/notification-provider";
import { HowItWorks } from "@/components/ui/how-it-works";

// --- Types ---

type ViewMode = "grid" | "list";
type SortField = "title" | "date" | "type";
type SortDirection = "asc" | "desc";

interface DisplayDocument {
  id: string;
  title: string;
  type: string;
  status: "processing" | "indexed" | "error";
  createdAt: string;
  metadata: Record<string, unknown> | null;
  sourceUrl: string | null;
}

function mapApiDocToDisplay(doc: DocumentResponse): DisplayDocument {
  return {
    id: doc.id,
    title: doc.title,
    type: doc.doc_type || "PDF",
    status: "indexed", // Backend doesn't have processing status; treat all as indexed
    createdAt: new Date(doc.created_at).toLocaleDateString(),
    metadata: doc.metadata,
    sourceUrl: doc.source_url,
  };
}

// --- Config ---

const statusConfig: Record<
  DisplayDocument["status"],
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

const docTypeIcon: Record<string, React.ReactNode> = {
  PDF: <FileText className="h-4 w-4 text-accent-rose" />,
  pdf: <FileText className="h-4 w-4 text-accent-rose" />,
  Report: <Layers className="h-4 w-4 text-accent-blue" />,
  report: <Layers className="h-4 w-4 text-accent-blue" />,
  Patent: <FileText className="h-4 w-4 text-accent-amber" />,
  patent: <FileText className="h-4 w-4 text-accent-amber" />,
  "Startup Profile": <FileText className="h-4 w-4 text-accent-violet" />,
  startup_profile: <FileText className="h-4 w-4 text-accent-violet" />,
  Web: <Globe className="h-4 w-4 text-accent-cyan" />,
  web: <Globe className="h-4 w-4 text-accent-cyan" />,
};

function getDocIcon(type: string): React.ReactNode {
  return docTypeIcon[type] || <FileText className="h-4 w-4 text-text-muted" />;
}

const ALLOWED_TYPES = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

interface UploadFile {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "complete" | "error";
  error?: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DisplayDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailDoc, setDetailDoc] = useState<DisplayDocument | null>(null);
  const [uploads, setUploads] = useState<UploadFile[]>([]);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const { notify } = useNotifications();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch documents from API
  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const response = await apiClient.listDocuments({ limit: 100 });
      setDocuments(response.data.map(mapApiDocToDisplay));
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load documents"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Filtering and sorting (client-side on loaded data)
  const filteredDocs = documents
    .filter((doc) => {
      const matchesSearch =
        doc.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType =
        typeFilter === "all" ||
        doc.type.toLowerCase() === typeFilter.toLowerCase();
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      switch (sortField) {
        case "title":
          return a.title.localeCompare(b.title) * dir;
        case "date":
          return (
            (new Date(a.createdAt).getTime() -
              new Date(b.createdAt).getTime()) *
            dir
          );
        case "type":
          return a.type.localeCompare(b.type) * dir;
        default:
          return 0;
      }
    });

  // Selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredDocs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDocs.map((d) => d.id)));
    }
  };

  const handleDelete = async (id: string) => {
    const deletedTitle = documents.find((d) => d.id === id)?.title;
    setDeleting((prev) => new Set(prev).add(id));
    try {
      await apiClient.deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      notify({
        type: "document_deleted",
        title: "Document deleted",
        description: deletedTitle,
      });
    } catch (err) {
      // Show error inline (in a production app, use a toast)
      console.error("Failed to delete document:", err);
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    await Promise.allSettled(ids.map((id) => handleDelete(id)));
  };

  // Real upload
  const uploadFile = async (file: File) => {
    const uploadId = `upload-${Date.now()}-${file.name}`;
    const uploadFile: UploadFile = {
      id: uploadId,
      name: file.name,
      size: file.size,
      progress: 0,
      status: "uploading",
    };

    // Validate type
    if (
      !ALLOWED_TYPES.includes(file.type) &&
      !file.name.endsWith(".pdf") &&
      !file.name.endsWith(".txt") &&
      !file.name.endsWith(".csv") &&
      !file.name.endsWith(".docx")
    ) {
      uploadFile.status = "error";
      uploadFile.error = "Unsupported file type";
      uploadFile.progress = 100;
      setUploads((prev) => [...prev, uploadFile]);
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      uploadFile.status = "error";
      uploadFile.error = "File exceeds 50MB limit";
      uploadFile.progress = 100;
      setUploads((prev) => [...prev, uploadFile]);
      return;
    }

    setUploads((prev) => [...prev, uploadFile]);

    // Show indeterminate progress
    setUploads((prev) =>
      prev.map((u) => (u.id === uploadId ? { ...u, progress: 50 } : u))
    );

    try {
      const title = file.name.replace(/\.[^/.]+$/, "");
      const doc = await apiClient.uploadDocument(file, title);

      setUploads((prev) =>
        prev.map((u) =>
          u.id === uploadId
            ? { ...u, progress: 100, status: "complete" }
            : u
        )
      );

      // Add the real document to our list
      setDocuments((prev) => [mapApiDocToDisplay(doc), ...prev]);
      notify({
        type: "document_uploaded",
        title: "Document uploaded",
        description: `${doc.title} — indexing for retrieval…`,
        href: "/documents",
      });
    } catch (err) {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === uploadId
            ? {
                ...u,
                progress: 100,
                status: "error",
                error:
                  err instanceof Error ? err.message : "Upload failed",
              }
            : u
        )
      );
    }
  };

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
    const files = Array.from(e.dataTransfer.files);
    files.forEach(uploadFile);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(uploadFile);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Get unique doc types from data
  const docTypes = Array.from(new Set(documents.map((d) => d.type)));

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Documents</h1>
            <p className="mt-1 text-text-secondary">
              Upload and manage documents for knowledge extraction.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.txt,.csv,.docx"
              onChange={handleFileSelect}
            />
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </div>
        </div>

        <HowItWorks title="How documents work">
          <p>
            Upload reports, filings, research papers, or notes (PDF or text).
            Each document is split into passages and embedded, so your analyses
            can <strong>retrieve and cite them</strong> as the document half of
            their evidence.
          </p>
          <p>
            Companies, technologies, and markets — and how they relate — are
            also extracted into the{" "}
            <a href="/knowledge" className="text-accent-blue hover:underline">
              Knowledge Graph
            </a>
            .
          </p>
        </HowItWorks>

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-all duration-300",
            isDragOver
              ? "border-accent-blue bg-accent-blue/5"
              : "border-border-subtle bg-bg-secondary hover:border-accent-blue/50"
          )}
        >
          <div
            className={cn(
              "rounded-full p-3 transition-colors",
              isDragOver ? "bg-accent-blue/20" : "bg-bg-tertiary"
            )}
          >
            <Upload
              className={cn(
                "h-6 w-6 transition-colors",
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

        {/* Upload progress */}
        {uploads.length > 0 && (
          <Card className="animate-fade-in">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Uploads</CardTitle>
                <button
                  onClick={() => setUploads([])}
                  className="text-text-muted hover:text-text-primary"
                  aria-label="Clear uploads"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {uploads.map((upload) => (
                <div key={upload.id} className="flex items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-text-muted" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate font-medium text-text-primary">
                        {upload.name}
                      </span>
                      <span className="text-text-muted">
                        {upload.status === "error"
                          ? upload.error
                          : `${Math.round(upload.progress)}%`}
                      </span>
                    </div>
                    <Progress
                      value={upload.progress}
                      size="sm"
                      color={
                        upload.status === "error"
                          ? "rose"
                          : upload.status === "complete"
                          ? "emerald"
                          : "blue"
                      }
                    />
                  </div>
                </div>
              ))}
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
                    Failed to load documents
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">{loadError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={fetchDocuments}
                  >
                    Retry
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading skeleton */}
        {loading && (
          <Card>
            <CardContent className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="skeleton h-4 w-4 rounded" />
                  <div className="skeleton h-4 flex-1" />
                  <div className="skeleton h-4 w-20" />
                  <div className="skeleton h-4 w-24" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Content when loaded */}
        {!loading && !loadError && (
          <>
            {/* Toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-md border border-border-default bg-bg-tertiary py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
                  />
                </div>

                {/* Type filter */}
                {docTypes.length > 0 && (
                  <div className="relative">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilterMenu(!showFilterMenu)}
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      {typeFilter === "all" ? "All Types" : typeFilter}
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    {showFilterMenu && (
                      <div className="absolute left-0 top-full z-20 mt-1 rounded-lg border border-border-default bg-bg-elevated py-1 shadow-xl animate-fade-in min-w-[160px]">
                        <button
                          className={cn(
                            "w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-bg-hover",
                            typeFilter === "all"
                              ? "text-accent-blue"
                              : "text-text-secondary"
                          )}
                          onClick={() => {
                            setTypeFilter("all");
                            setShowFilterMenu(false);
                          }}
                        >
                          All Types
                        </button>
                        {docTypes.map((type) => (
                          <button
                            key={type}
                            className={cn(
                              "w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-bg-hover",
                              typeFilter === type
                                ? "text-accent-blue"
                                : "text-text-secondary"
                            )}
                            onClick={() => {
                              setTypeFilter(type);
                              setShowFilterMenu(false);
                            }}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Sort */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleSort(
                      sortField === "date"
                        ? "title"
                        : sortField === "title"
                        ? "type"
                        : "date"
                    )
                  }
                >
                  <ArrowUpDown className="h-4 w-4" />
                  {sortField === "date"
                    ? "Date"
                    : sortField === "title"
                    ? "Title"
                    : "Type"}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <Button variant="outline" size="sm" onClick={handleBulkDelete}>
                    <Trash2 className="h-4 w-4" />
                    Delete ({selectedIds.size})
                  </Button>
                )}

                {/* View toggle */}
                <div className="flex rounded-lg border border-border-default bg-bg-tertiary p-0.5">
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "rounded-md p-1.5 transition-colors",
                      viewMode === "list"
                        ? "bg-bg-secondary text-text-primary shadow-sm"
                        : "text-text-muted hover:text-text-secondary"
                    )}
                    aria-label="List view"
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "rounded-md p-1.5 transition-colors",
                      viewMode === "grid"
                        ? "bg-bg-secondary text-text-primary shadow-sm"
                        : "text-text-muted hover:text-text-secondary"
                    )}
                    aria-label="Grid view"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Document count */}
            <p className="text-xs text-text-muted">
              {filteredDocs.length} document{filteredDocs.length !== 1 ? "s" : ""}
              {typeFilter !== "all" && ` (filtered by ${typeFilter})`}
            </p>

            {/* Empty state */}
            {documents.length === 0 && (
              <div className="py-16 text-center">
                <FileText className="mx-auto h-12 w-12 text-text-muted/50" />
                <h3 className="mt-4 text-sm font-semibold text-text-primary">
                  No documents ingested yet
                </h3>
                <p className="mt-1 text-sm text-text-muted">
                  Upload your first document to start building your knowledge
                  base.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Upload Document
                </Button>
              </div>
            )}

            {/* List View */}
            {documents.length > 0 && viewMode === "list" && (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border-default text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                          <th className="p-4 pr-2 w-10">
                            <input
                              type="checkbox"
                              checked={
                                selectedIds.size === filteredDocs.length &&
                                filteredDocs.length > 0
                              }
                              onChange={toggleSelectAll}
                              className="rounded border-border-default bg-bg-tertiary"
                              aria-label="Select all"
                            />
                          </th>
                          <th
                            className="p-4 pr-4 cursor-pointer hover:text-text-secondary"
                            onClick={() => handleSort("title")}
                          >
                            Title{" "}
                            {sortField === "title" &&
                              (sortDirection === "asc" ? "^" : "v")}
                          </th>
                          <th
                            className="p-4 pr-4 cursor-pointer hover:text-text-secondary"
                            onClick={() => handleSort("type")}
                          >
                            Type{" "}
                            {sortField === "type" &&
                              (sortDirection === "asc" ? "^" : "v")}
                          </th>
                          <th
                            className="p-4 pr-4 cursor-pointer hover:text-text-secondary"
                            onClick={() => handleSort("date")}
                          >
                            Date{" "}
                            {sortField === "date" &&
                              (sortDirection === "asc" ? "^" : "v")}
                          </th>
                          <th className="p-4 pr-4">Status</th>
                          <th className="p-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-default">
                        {filteredDocs.map((doc) => {
                          const config = statusConfig[doc.status];
                          return (
                            <tr
                              key={doc.id}
                              className={cn(
                                "group transition-colors hover:bg-bg-hover cursor-pointer",
                                selectedIds.has(doc.id) && "bg-accent-blue/5"
                              )}
                              onClick={() => setDetailDoc(doc)}
                            >
                              <td
                                className="p-4 pr-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(doc.id)}
                                  onChange={() => toggleSelect(doc.id)}
                                  className="rounded border-border-default bg-bg-tertiary"
                                />
                              </td>
                              <td className="p-4 pr-4">
                                <div className="flex items-center gap-2.5">
                                  {getDocIcon(doc.type)}
                                  <span className="text-sm font-medium text-text-primary">
                                    {doc.title}
                                  </span>
                                </div>
                              </td>
                              <td className="p-4 pr-4">
                                <Badge>{doc.type}</Badge>
                              </td>
                              <td className="p-4 pr-4 text-sm text-text-secondary">
                                {doc.createdAt}
                              </td>
                              <td className="p-4 pr-4">
                                <Badge variant={config.variant} className="gap-1">
                                  {config.icon}
                                  {config.label}
                                </Badge>
                              </td>
                              <td
                                className="p-4"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  className="rounded p-1 text-text-muted opacity-0 transition-all hover:bg-accent-rose/10 hover:text-accent-rose group-hover:opacity-100"
                                  aria-label={`Delete ${doc.title}`}
                                  onClick={() => handleDelete(doc.id)}
                                  disabled={deleting.has(doc.id)}
                                >
                                  {deleting.has(doc.id) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filteredDocs.length === 0 && documents.length > 0 && (
                      <div className="py-12 text-center text-sm text-text-muted">
                        No documents found matching your search.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Grid View */}
            {documents.length > 0 && viewMode === "grid" && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredDocs.map((doc) => {
                  const config = statusConfig[doc.status];
                  return (
                    <Card
                      key={doc.id}
                      className={cn(
                        "cursor-pointer transition-all duration-200 hover:border-accent-blue/30 hover:shadow-md",
                        selectedIds.has(doc.id) &&
                          "border-accent-blue/50 bg-accent-blue/5"
                      )}
                      onClick={() => setDetailDoc(doc)}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {getDocIcon(doc.type)}
                            <Badge>{doc.type}</Badge>
                          </div>
                          <Badge variant={config.variant} className="gap-1">
                            {config.icon}
                            {config.label}
                          </Badge>
                        </div>
                        <h3 className="mt-3 text-sm font-semibold text-text-primary line-clamp-2">
                          {doc.title}
                        </h3>
                        <div className="mt-3 flex items-center gap-3 text-xs text-text-muted">
                          <span>{doc.createdAt}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {filteredDocs.length === 0 && documents.length > 0 && (
                  <div className="col-span-full py-12 text-center text-sm text-text-muted">
                    No documents found matching your search.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Document Detail Modal */}
        <Dialog
          open={detailDoc !== null}
          onClose={() => setDetailDoc(null)}
          className="max-w-xl"
        >
          {detailDoc && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 pr-8">
                  {getDocIcon(detailDoc.type)}
                  <DialogTitle>{detailDoc.title}</DialogTitle>
                </div>
              </DialogHeader>
              <DialogBody className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-text-muted">Type</p>
                    <Badge>{detailDoc.type}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-text-muted">Status</p>
                    <Badge
                      variant={statusConfig[detailDoc.status].variant}
                      className="gap-1"
                    >
                      {statusConfig[detailDoc.status].icon}
                      {statusConfig[detailDoc.status].label}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-text-muted">
                      Upload Date
                    </p>
                    <p className="text-sm text-text-primary">
                      {detailDoc.createdAt}
                    </p>
                  </div>
                  {detailDoc.sourceUrl && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-text-muted">
                        Source URL
                      </p>
                      <a
                        href={detailDoc.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-accent-blue hover:underline"
                      >
                        {detailDoc.sourceUrl}
                      </a>
                    </div>
                  )}
                </div>

                {detailDoc.metadata && Object.keys(detailDoc.metadata).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-text-muted">Metadata</p>
                    <div className="space-y-1.5">
                      {Object.entries(detailDoc.metadata).map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between rounded bg-bg-tertiary px-3 py-1.5 text-xs"
                        >
                          <span className="text-text-muted">{key}</span>
                          <span className="font-medium text-text-primary">
                            {String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </DialogBody>
              <DialogFooter>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleDelete(detailDoc.id);
                    setDetailDoc(null);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
                <Button size="sm" onClick={() => setDetailDoc(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

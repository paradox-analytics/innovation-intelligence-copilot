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
import { useCallback, useRef, useState } from "react";

// --- Types ---

type DocType = "PDF" | "Report" | "Patent" | "Startup Profile" | "Web";
type DocStatus = "processing" | "indexed" | "error";
type ViewMode = "grid" | "list";
type SortField = "title" | "date" | "type";
type SortDirection = "asc" | "desc";

interface MockDocument {
  id: string;
  title: string;
  type: DocType;
  status: DocStatus;
  createdAt: string;
  pageCount: number;
  fileSize: string;
  entities: number;
  chunks: number;
  description?: string;
}

// --- Mock data ---

const MOCK_DOCUMENTS: MockDocument[] = [
  {
    id: "d1",
    title: "BASF Annual Report 2023",
    type: "PDF",
    status: "indexed",
    createdAt: "2024-01-15",
    pageCount: 248,
    fileSize: "14.2 MB",
    entities: 87,
    chunks: 312,
    description: "Comprehensive annual report covering financials, strategy, and sustainability initiatives.",
  },
  {
    id: "d2",
    title: "McKinsey Bio-Revolution Report",
    type: "Report",
    status: "indexed",
    createdAt: "2024-01-12",
    pageCount: 64,
    fileSize: "8.7 MB",
    entities: 45,
    chunks: 128,
    description: "Analysis of the biological revolution and its impact on industry.",
  },
  {
    id: "d3",
    title: "Precision Fermentation Market Analysis 2024-2030",
    type: "Report",
    status: "indexed",
    createdAt: "2024-01-10",
    pageCount: 112,
    fileSize: "12.1 MB",
    entities: 63,
    chunks: 224,
    description: "Market sizing and competitive landscape for precision fermentation technologies.",
  },
  {
    id: "d4",
    title: "EU Green Deal Industrial Plan Summary",
    type: "Web",
    status: "indexed",
    createdAt: "2024-01-08",
    pageCount: 38,
    fileSize: "2.4 MB",
    entities: 29,
    chunks: 76,
    description: "Summary of EU policy framework for green industrial transformation.",
  },
  {
    id: "d5",
    title: "Novozymes-DSM Merger Impact Assessment",
    type: "PDF",
    status: "processing",
    createdAt: "2024-01-20",
    pageCount: 22,
    fileSize: "3.8 MB",
    entities: 0,
    chunks: 0,
    description: "Strategic assessment of the Novozymes-DSM merger implications.",
  },
  {
    id: "d6",
    title: "Internal Strategy Memo - Biotech Expansion",
    type: "PDF",
    status: "error",
    createdAt: "2024-01-18",
    pageCount: 8,
    fileSize: "1.2 MB",
    entities: 0,
    chunks: 0,
    description: "Internal memo on biotechnology expansion strategy. Processing failed due to encryption.",
  },
  {
    id: "d7",
    title: "US11505790B2 - Microbial Production Methods",
    type: "Patent",
    status: "indexed",
    createdAt: "2024-01-05",
    pageCount: 34,
    fileSize: "5.6 MB",
    entities: 18,
    chunks: 68,
    description: "Ginkgo Bioworks patent for enhanced microbial production of specialty chemicals.",
  },
  {
    id: "d8",
    title: "Solugen Series C Pitch Deck",
    type: "Startup Profile",
    status: "indexed",
    createdAt: "2024-01-03",
    pageCount: 28,
    fileSize: "4.1 MB",
    entities: 22,
    chunks: 56,
    description: "Investor deck for Solugen's chemoenzymatic process platform.",
  },
];

const statusConfig: Record<
  DocStatus,
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

const docTypeIcon: Record<DocType, React.ReactNode> = {
  PDF: <FileText className="h-4 w-4 text-accent-rose" />,
  Report: <Layers className="h-4 w-4 text-accent-blue" />,
  Patent: <FileText className="h-4 w-4 text-accent-amber" />,
  "Startup Profile": <FileText className="h-4 w-4 text-accent-violet" />,
  Web: <Globe className="h-4 w-4 text-accent-cyan" />,
};

const ALLOWED_TYPES = ["application/pdf", "text/plain", "text/csv", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

interface UploadFile {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "complete" | "error";
  error?: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<MockDocument[]>(MOCK_DOCUMENTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [typeFilter, setTypeFilter] = useState<DocType | "all">("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailDoc, setDetailDoc] = useState<MockDocument | null>(null);
  const [uploads, setUploads] = useState<UploadFile[]>([]);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtering
  const filteredDocs = documents
    .filter((doc) => {
      const matchesSearch =
        doc.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === "all" || doc.type === typeFilter;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      switch (sortField) {
        case "title":
          return a.title.localeCompare(b.title) * dir;
        case "date":
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
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

  const handleBulkDelete = () => {
    setDocuments((prev) => prev.filter((d) => !selectedIds.has(d.id)));
    setSelectedIds(new Set());
  };

  const handleDelete = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Upload simulation
  const simulateUpload = (file: File) => {
    const uploadFile: UploadFile = {
      id: `upload-${Date.now()}-${file.name}`,
      name: file.name,
      size: file.size,
      progress: 0,
      status: "uploading",
    };

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith(".pdf") && !file.name.endsWith(".txt") && !file.name.endsWith(".csv") && !file.name.endsWith(".docx")) {
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

    // Simulate progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 25 + 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setUploads((prev) =>
          prev.map((u) =>
            u.id === uploadFile.id
              ? { ...u, progress: 100, status: "complete" }
              : u
          )
        );
        // Add to documents
        const newDoc: MockDocument = {
          id: `d-${Date.now()}`,
          title: file.name.replace(/\.[^/.]+$/, ""),
          type: "PDF",
          status: "processing",
          createdAt: new Date().toISOString().split("T")[0],
          pageCount: Math.floor(Math.random() * 100) + 1,
          fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          entities: 0,
          chunks: 0,
        };
        setDocuments((prev) => [newDoc, ...prev]);
      } else {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === uploadFile.id ? { ...u, progress } : u
          )
        );
      }
    }, 300);
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
    files.forEach(simulateUpload);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(simulateUpload);
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

  const docTypes: DocType[] = ["PDF", "Report", "Patent", "Startup Profile", "Web"];

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
                      typeFilter === "all" ? "text-accent-blue" : "text-text-secondary"
                    )}
                    onClick={() => { setTypeFilter("all"); setShowFilterMenu(false); }}
                  >
                    All Types
                  </button>
                  {docTypes.map((type) => (
                    <button
                      key={type}
                      className={cn(
                        "w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-bg-hover",
                        typeFilter === type ? "text-accent-blue" : "text-text-secondary"
                      )}
                      onClick={() => { setTypeFilter(type); setShowFilterMenu(false); }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sort */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSort(sortField === "date" ? "title" : sortField === "title" ? "type" : "date")}
            >
              <ArrowUpDown className="h-4 w-4" />
              {sortField === "date" ? "Date" : sortField === "title" ? "Title" : "Type"}
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

        {/* List View */}
        {viewMode === "list" && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border-default text-left text-xs font-medium uppercase tracking-wider text-text-muted">
                      <th className="p-4 pr-2 w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === filteredDocs.length && filteredDocs.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-border-default bg-bg-tertiary"
                          aria-label="Select all"
                        />
                      </th>
                      <th className="p-4 pr-4 cursor-pointer hover:text-text-secondary" onClick={() => handleSort("title")}>
                        Title {sortField === "title" && (sortDirection === "asc" ? "^" : "v")}
                      </th>
                      <th className="p-4 pr-4 cursor-pointer hover:text-text-secondary" onClick={() => handleSort("type")}>
                        Type {sortField === "type" && (sortDirection === "asc" ? "^" : "v")}
                      </th>
                      <th className="p-4 pr-4">Pages</th>
                      <th className="p-4 pr-4">Size</th>
                      <th className="p-4 pr-4 cursor-pointer hover:text-text-secondary" onClick={() => handleSort("date")}>
                        Date {sortField === "date" && (sortDirection === "asc" ? "^" : "v")}
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
                          <td className="p-4 pr-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(doc.id)}
                              onChange={() => toggleSelect(doc.id)}
                              className="rounded border-border-default bg-bg-tertiary"
                            />
                          </td>
                          <td className="p-4 pr-4">
                            <div className="flex items-center gap-2.5">
                              {docTypeIcon[doc.type]}
                              <span className="text-sm font-medium text-text-primary">
                                {doc.title}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 pr-4">
                            <Badge>{doc.type}</Badge>
                          </td>
                          <td className="p-4 pr-4 text-sm text-text-secondary">
                            {doc.pageCount}
                          </td>
                          <td className="p-4 pr-4 text-sm text-text-secondary">
                            {doc.fileSize}
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
                          <td className="p-4" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="rounded p-1 text-text-muted opacity-0 transition-all hover:bg-accent-rose/10 hover:text-accent-rose group-hover:opacity-100"
                              aria-label={`Delete ${doc.title}`}
                              onClick={() => handleDelete(doc.id)}
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
        )}

        {/* Grid View */}
        {viewMode === "grid" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDocs.map((doc) => {
              const config = statusConfig[doc.status];
              return (
                <Card
                  key={doc.id}
                  className={cn(
                    "cursor-pointer transition-all duration-200 hover:border-accent-blue/30 hover:shadow-md",
                    selectedIds.has(doc.id) && "border-accent-blue/50 bg-accent-blue/5"
                  )}
                  onClick={() => setDetailDoc(doc)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {docTypeIcon[doc.type]}
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
                      <span>{doc.pageCount} pages</span>
                      <span>{doc.fileSize}</span>
                      <span>{doc.createdAt}</span>
                    </div>
                    {doc.status === "indexed" && (
                      <div className="mt-3 flex items-center gap-3 text-xs text-text-muted">
                        <span>{doc.entities} entities</span>
                        <span>{doc.chunks} chunks</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {filteredDocs.length === 0 && (
              <div className="col-span-full py-12 text-center text-sm text-text-muted">
                No documents found matching your search.
              </div>
            )}
          </div>
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
                  {docTypeIcon[detailDoc.type]}
                  <DialogTitle>{detailDoc.title}</DialogTitle>
                </div>
              </DialogHeader>
              <DialogBody className="space-y-5">
                {detailDoc.description && (
                  <p className="text-sm text-text-secondary">
                    {detailDoc.description}
                  </p>
                )}

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
                    <p className="text-xs font-medium text-text-muted">Pages</p>
                    <p className="text-sm text-text-primary">{detailDoc.pageCount}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-text-muted">File Size</p>
                    <p className="text-sm text-text-primary">{detailDoc.fileSize}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-text-muted">Entities Extracted</p>
                    <p className="text-sm text-text-primary">{detailDoc.entities}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-text-muted">Chunk Count</p>
                    <p className="text-sm text-text-primary">{detailDoc.chunks}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-text-muted">Upload Date</p>
                    <p className="text-sm text-text-primary">{detailDoc.createdAt}</p>
                  </div>
                </div>

                {detailDoc.status === "processing" && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-text-muted">Processing Progress</p>
                    <Progress value={42} showLabel color="blue" />
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

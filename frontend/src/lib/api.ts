const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const TOKEN_KEY = "iic_token";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

function clearToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }
}

// ---------------------------------------------------------------------------
// Shared response types
// ---------------------------------------------------------------------------

interface ApiResponse<T> {
  data: T;
}

interface ApiListResponse<T> {
  data: T[];
  total: number;
}

// ---------------------------------------------------------------------------
// Auth types
// ---------------------------------------------------------------------------

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
}

interface UserResponse {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface APIKeyResponse {
  api_key: string;
}

// ---------------------------------------------------------------------------
// Analysis types
// ---------------------------------------------------------------------------

interface AnalysisSubmitRequest {
  query: string;
  context?: Record<string, unknown>;
}

interface AnalysisSubmitResponse {
  analysis_id: string;
  status: string;
}

interface AnalysisResultResponse {
  id: string;
  query: string;
  status: string;
  result: Record<string, unknown> | null;
  confidence_score: number | null;
  created_at: string;
  completed_at: string | null;
}

interface AnalysisStatusResponse {
  id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

// ---------------------------------------------------------------------------
// Document types
// ---------------------------------------------------------------------------

interface DocumentResponse {
  id: string;
  title: string;
  source_url: string | null;
  doc_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Knowledge types
// ---------------------------------------------------------------------------

interface EntityResponse {
  id: string;
  name: string;
  entity_type: string;
  properties: Record<string, unknown> | null;
  neo4j_id: string | null;
}

interface RelationshipResponse {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  properties: Record<string, unknown> | null;
}

interface EntityWithRelationshipsResponse {
  entity: EntityResponse;
  relationships: RelationshipResponse[];
}

interface SubgraphResponse {
  entities: EntityResponse[];
  relationships: RelationshipResponse[];
}

// ---------------------------------------------------------------------------
// Report types
// ---------------------------------------------------------------------------

interface ReportMetadata {
  id: string;
  analysis_id: string;
  format: string;
  generated_at: string;
}

interface ReportResponse {
  metadata: ReportMetadata;
  title: string;
  executive_summary: string;
  sections: Array<Record<string, unknown>>;
  confidence_score: number | null;
}

interface ReportGenerateRequest {
  analysis_id: string;
  format?: string;
  include_appendix?: boolean;
}

// ---------------------------------------------------------------------------
// SSE event types
// ---------------------------------------------------------------------------

interface SSEEvent {
  event: string;
  timestamp: string;
  agent?: string;
  status?: string;
  partial_result?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
}

// ---------------------------------------------------------------------------
// API Client
// ---------------------------------------------------------------------------

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = getToken();
    const headers: Record<string, string> = {
      ...(options?.headers as Record<string, string>),
    };

    // Only set Content-Type for non-FormData requests
    if (!(options?.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `API error ${response.status}: ${errorBody || response.statusText}`
      );
    }

    // 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  async login(body: LoginRequest): Promise<TokenResponse> {
    const response = await this.request<ApiResponse<TokenResponse>>(
      "/auth/login",
      { method: "POST", body: JSON.stringify(body) }
    );
    setToken(response.data.access_token);
    return response.data;
  }

  async register(body: RegisterRequest): Promise<UserResponse> {
    const response = await this.request<ApiResponse<UserResponse>>(
      "/auth/register",
      { method: "POST", body: JSON.stringify(body) }
    );
    return response.data;
  }

  async getMe(): Promise<UserResponse> {
    const response = await this.request<ApiResponse<UserResponse>>("/auth/me");
    return response.data;
  }

  async generateApiKey(): Promise<APIKeyResponse> {
    const response = await this.request<ApiResponse<APIKeyResponse>>(
      "/auth/api-key",
      { method: "POST" }
    );
    return response.data;
  }

  logout(): void {
    clearToken();
  }

  isAuthenticated(): boolean {
    return getToken() !== null;
  }

  // -------------------------------------------------------------------------
  // Analysis
  // -------------------------------------------------------------------------

  async submitAnalysis(
    body: AnalysisSubmitRequest
  ): Promise<AnalysisSubmitResponse> {
    const response = await this.request<ApiResponse<AnalysisSubmitResponse>>(
      "/analyze",
      { method: "POST", body: JSON.stringify(body) }
    );
    return response.data;
  }

  async getAnalysis(id: string): Promise<AnalysisResultResponse> {
    const response = await this.request<ApiResponse<AnalysisResultResponse>>(
      `/analyze/${id}`
    );
    return response.data;
  }

  async getAnalysisStatus(id: string): Promise<AnalysisStatusResponse> {
    const response = await this.request<ApiResponse<AnalysisStatusResponse>>(
      `/analyze/${id}/status`
    );
    return response.data;
  }

  /**
   * Subscribe to SSE stream for real-time analysis progress.
   * Returns an AbortController to allow cancelling the stream.
   */
  streamAnalysis(
    id: string,
    onEvent: (event: SSEEvent) => void,
    onDone: () => void,
    onError: (error: Error) => void
  ): AbortController {
    const controller = new AbortController();
    const url = `${this.baseUrl}/analyze/${id}/stream`;

    const connect = async () => {
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: "text/event-stream",
          },
        });
        if (!response.ok) {
          throw new Error(`SSE error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body for SSE stream");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let currentEventType = "message";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (currentEventType === "done") {
                onDone();
                return;
              }
              try {
                const parsed = JSON.parse(data) as SSEEvent;
                onEvent(parsed);
              } catch {
                // ignore non-JSON data lines
              }
            }
          }
        }
        onDone();
      } catch (err) {
        if (controller.signal.aborted) return;
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    connect();
    return controller;
  }

  // -------------------------------------------------------------------------
  // Documents
  // -------------------------------------------------------------------------

  async listDocuments(
    params?: { offset?: number; limit?: number; doc_type?: string }
  ): Promise<ApiListResponse<DocumentResponse>> {
    const searchParams = new URLSearchParams();
    if (params?.offset !== undefined)
      searchParams.set("offset", String(params.offset));
    if (params?.limit !== undefined)
      searchParams.set("limit", String(params.limit));
    if (params?.doc_type) searchParams.set("doc_type", params.doc_type);
    const qs = searchParams.toString();
    return this.request<ApiListResponse<DocumentResponse>>(
      `/documents${qs ? `?${qs}` : ""}`
    );
  }

  async uploadDocument(
    file: File,
    title: string,
    docType?: string,
    sourceUrl?: string
  ): Promise<DocumentResponse> {
    const formData = new FormData();
    formData.append("file", file);

    const params = new URLSearchParams();
    params.set("title", title);
    if (docType) params.set("doc_type", docType);
    if (sourceUrl) params.set("source_url", sourceUrl);

    const response = await this.request<ApiResponse<DocumentResponse>>(
      `/documents?${params.toString()}`,
      { method: "POST", body: formData }
    );
    return response.data;
  }

  async deleteDocument(id: string): Promise<void> {
    await this.request<void>(`/documents/${id}`, { method: "DELETE" });
  }

  // -------------------------------------------------------------------------
  // Knowledge Graph
  // -------------------------------------------------------------------------

  async listEntities(
    params?: { q?: string; entity_type?: string; offset?: number; limit?: number }
  ): Promise<ApiListResponse<EntityResponse>> {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set("q", params.q);
    if (params?.entity_type) searchParams.set("entity_type", params.entity_type);
    if (params?.offset !== undefined)
      searchParams.set("offset", String(params.offset));
    if (params?.limit !== undefined)
      searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return this.request<ApiListResponse<EntityResponse>>(
      `/knowledge/entities${qs ? `?${qs}` : ""}`
    );
  }

  async getEntityRelationships(
    entityId: string
  ): Promise<EntityWithRelationshipsResponse> {
    const response = await this.request<
      ApiResponse<EntityWithRelationshipsResponse>
    >(`/knowledge/entities/${entityId}/relationships`);
    return response.data;
  }

  async getSubgraph(
    topic: string,
    depth?: number
  ): Promise<SubgraphResponse> {
    const params = new URLSearchParams({ topic });
    if (depth !== undefined) params.set("depth", String(depth));
    const response = await this.request<ApiResponse<SubgraphResponse>>(
      `/knowledge/graph?${params.toString()}`
    );
    return response.data;
  }

  // -------------------------------------------------------------------------
  // Reports
  // -------------------------------------------------------------------------

  async generateReport(body: ReportGenerateRequest): Promise<ReportResponse> {
    const response = await this.request<ApiResponse<ReportResponse>>(
      "/reports/generate",
      { method: "POST", body: JSON.stringify(body) }
    );
    return response.data;
  }

  async getReport(
    reportId: string,
    analysisId: string
  ): Promise<ReportResponse> {
    const response = await this.request<ApiResponse<ReportResponse>>(
      `/reports/${reportId}?analysis_id=${encodeURIComponent(analysisId)}`
    );
    return response.data;
  }
}

export const apiClient = new ApiClient(BASE_URL);

export {
  getToken,
  setToken,
  clearToken,
  TOKEN_KEY,
};

export type {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  UserResponse,
  APIKeyResponse,
  AnalysisSubmitRequest,
  AnalysisSubmitResponse,
  AnalysisResultResponse,
  AnalysisStatusResponse,
  DocumentResponse,
  EntityResponse,
  RelationshipResponse,
  EntityWithRelationshipsResponse,
  SubgraphResponse,
  ReportMetadata,
  ReportResponse,
  ReportGenerateRequest,
  SSEEvent,
  ApiResponse,
  ApiListResponse,
};

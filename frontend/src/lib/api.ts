const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ApiResponse<T> {
  data: T;
  error?: string;
}

interface ApiListResponse<T> {
  data: T[];
  total: number;
  error?: string;
}

interface AnalysisRequest {
  question: string;
  depth?: "quick" | "standard" | "deep";
  focus_areas?: string[];
}

interface AgentStatus {
  agent: string;
  status: "pending" | "running" | "complete" | "error";
  message?: string;
}

interface AnalysisResult {
  id: string;
  question: string;
  recommendation: string;
  confidence_score: number;
  executive_summary: string;
  supporting_evidence: EvidenceItemResponse[];
  contrarian_evidence: EvidenceItemResponse[];
  strategic_risks: string[];
  key_assumptions: string[];
  agent_statuses: AgentStatus[];
  created_at: string;
}

interface EvidenceItemResponse {
  id: string;
  claim: string;
  source: string;
  source_url?: string;
  relevance: "high" | "medium" | "low";
}

interface DocumentResponse {
  id: string;
  title: string;
  type: string;
  status: "processing" | "indexed" | "error";
  created_at: string;
  page_count?: number;
}

interface KnowledgeEntity {
  id: string;
  name: string;
  type: "technology" | "company" | "startup" | "market" | "patent";
  description: string;
  connections: number;
}

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
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `API error ${response.status}: ${errorBody || response.statusText}`
      );
    }

    return response.json() as Promise<T>;
  }

  // Analysis endpoints
  async submitAnalysis(
    request: AnalysisRequest
  ): Promise<ApiResponse<AnalysisResult>> {
    return this.request("/api/v1/analyze", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async getAnalysis(id: string): Promise<ApiResponse<AnalysisResult>> {
    return this.request(`/api/v1/analyze/${id}`);
  }

  async listAnalyses(): Promise<ApiListResponse<AnalysisResult>> {
    return this.request("/api/v1/analyze");
  }

  // Document endpoints
  async uploadDocument(formData: FormData): Promise<ApiResponse<DocumentResponse>> {
    const url = `${this.baseUrl}/api/v1/documents`;
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `API error ${response.status}: ${errorBody || response.statusText}`
      );
    }

    return response.json() as Promise<ApiResponse<DocumentResponse>>;
  }

  async listDocuments(): Promise<ApiListResponse<DocumentResponse>> {
    return this.request("/api/v1/documents");
  }

  async deleteDocument(id: string): Promise<void> {
    await this.request(`/api/v1/documents/${id}`, {
      method: "DELETE",
    });
  }

  // Knowledge Graph endpoints
  async searchEntities(query: string): Promise<ApiListResponse<KnowledgeEntity>> {
    return this.request(
      `/api/v1/knowledge/entities?q=${encodeURIComponent(query)}`
    );
  }

  async getEntity(id: string): Promise<ApiResponse<KnowledgeEntity>> {
    return this.request(`/api/v1/knowledge/entities/${id}`);
  }
}

export const apiClient = new ApiClient(BASE_URL);

export type {
  AnalysisRequest,
  AnalysisResult,
  AgentStatus,
  EvidenceItemResponse,
  DocumentResponse,
  KnowledgeEntity,
  ApiResponse,
  ApiListResponse,
};

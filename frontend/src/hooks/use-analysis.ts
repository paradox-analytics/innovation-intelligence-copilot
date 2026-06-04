"use client";

import {
  apiClient,
  type AnalysisSubmitRequest,
  type AnalysisResultResponse,
  type SSEEvent,
} from "@/lib/api";
import { useCallback, useRef, useState } from "react";

type AnalysisStatus = "idle" | "submitting" | "streaming" | "polling" | "complete" | "error";

interface AgentProgress {
  agent: string;
  status: "waiting" | "running" | "complete" | "error";
  partialResult?: Record<string, unknown>;
}

interface UseAnalysisReturn {
  result: AnalysisResultResponse | null;
  status: AnalysisStatus;
  error: string | null;
  agentProgress: AgentProgress[];
  submit: (request: AnalysisSubmitRequest) => Promise<void>;
  reset: () => void;
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 150; // 5 minutes max

const AGENT_NAMES = ["research", "support", "skeptic", "risk", "trend", "executive"];

export function useAnalysis(): UseAnalysisReturn {
  const [result, setResult] = useState<AnalysisResultResponse | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [agentProgress, setAgentProgress] = useState<AgentProgress[]>(
    AGENT_NAMES.map((name) => ({ agent: name, status: "waiting" }))
  );
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef(0);
  const sseControllerRef = useRef<AbortController | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollCountRef.current = 0;
  }, []);

  const stopStreaming = useCallback(() => {
    if (sseControllerRef.current) {
      sseControllerRef.current.abort();
      sseControllerRef.current = null;
    }
  }, []);

  const fetchFinalResult = useCallback(async (analysisId: string) => {
    try {
      const analysis = await apiClient.getAnalysis(analysisId);
      setResult(analysis);
      setStatus("complete");
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "Failed to fetch final results"
      );
    }
  }, []);

  // Polling fallback when SSE is not available
  const pollForResult = useCallback(
    (analysisId: string) => {
      const poll = async () => {
        try {
          pollCountRef.current += 1;

          if (pollCountRef.current > MAX_POLL_ATTEMPTS) {
            stopPolling();
            setStatus("error");
            setError("Analysis timed out. Please try again.");
            return;
          }

          const statusResponse = await apiClient.getAnalysisStatus(analysisId);

          if (
            statusResponse.status === "COMPLETED" ||
            statusResponse.status === "completed"
          ) {
            stopPolling();
            await fetchFinalResult(analysisId);
          } else if (
            statusResponse.status === "FAILED" ||
            statusResponse.status === "failed"
          ) {
            stopPolling();
            setStatus("error");
            setError("Analysis failed. Please try again.");
          } else {
            pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
          }
        } catch (err) {
          stopPolling();
          setStatus("error");
          setError(
            err instanceof Error
              ? err.message
              : "Failed to fetch analysis status"
          );
        }
      };

      setStatus("polling");
      poll();
    },
    [stopPolling, fetchFinalResult]
  );

  // SSE streaming for real-time agent progress
  const startStreaming = useCallback(
    (analysisId: string) => {
      setStatus("streaming");

      const controller = apiClient.streamAnalysis(
        analysisId,
        // onEvent
        (event: SSEEvent) => {
          if (event.event === "agent_started" && event.agent) {
            setAgentProgress((prev) =>
              prev.map((ap) =>
                ap.agent === event.agent ? { ...ap, status: "running" } : ap
              )
            );
          } else if (event.event === "agent_completed" && event.agent) {
            setAgentProgress((prev) =>
              prev.map((ap) =>
                ap.agent === event.agent
                  ? {
                      ...ap,
                      status: "complete",
                      partialResult: event.partial_result,
                    }
                  : ap
              )
            );
          } else if (event.event === "analysis_complete") {
            // All agents done, fetch the full result
            setAgentProgress((prev) =>
              prev.map((ap) => ({ ...ap, status: "complete" }))
            );
            fetchFinalResult(analysisId);
          } else if (event.event === "analysis_error") {
            setStatus("error");
            setError(event.error || "Analysis failed");
          }
        },
        // onDone
        () => {
          // Stream closed; if not already complete, fetch result
          if (status !== "complete" && status !== "error") {
            fetchFinalResult(analysisId);
          }
        },
        // onError - fall back to polling
        () => {
          pollForResult(analysisId);
        }
      );

      sseControllerRef.current = controller;
    },
    [fetchFinalResult, pollForResult, status]
  );

  const submit = useCallback(
    async (request: AnalysisSubmitRequest) => {
      stopPolling();
      stopStreaming();
      setStatus("submitting");
      setError(null);
      setResult(null);
      setAgentProgress(
        AGENT_NAMES.map((name) => ({ agent: name, status: "waiting" }))
      );

      try {
        const response = await apiClient.submitAnalysis(request);
        const analysisId = response.analysis_id;

        // Try SSE streaming first, falls back to polling on error
        startStreaming(analysisId);
      } catch (err) {
        setStatus("error");
        setError(
          err instanceof Error ? err.message : "Failed to submit analysis"
        );
      }
    },
    [stopPolling, stopStreaming, startStreaming]
  );

  const reset = useCallback(() => {
    stopPolling();
    stopStreaming();
    setResult(null);
    setStatus("idle");
    setError(null);
    setAgentProgress(
      AGENT_NAMES.map((name) => ({ agent: name, status: "waiting" }))
    );
  }, [stopPolling, stopStreaming]);

  return { result, status, error, agentProgress, submit, reset };
}

export type { AgentProgress, AnalysisStatus, UseAnalysisReturn };

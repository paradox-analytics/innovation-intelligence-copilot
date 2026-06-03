"use client";

import {
  apiClient,
  type AnalysisRequest,
  type AnalysisResult,
} from "@/lib/api";
import { useCallback, useRef, useState } from "react";

type AnalysisStatus = "idle" | "submitting" | "polling" | "complete" | "error";

interface UseAnalysisReturn {
  result: AnalysisResult | null;
  status: AnalysisStatus;
  error: string | null;
  submit: (request: AnalysisRequest) => Promise<void>;
  reset: () => void;
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 150; // 5 minutes max

export function useAnalysis(): UseAnalysisReturn {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollCountRef.current = 0;
  }, []);

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

          const response = await apiClient.getAnalysis(analysisId);
          const analysis = response.data;

          setResult(analysis);

          const allComplete = analysis.agent_statuses.every(
            (agent) =>
              agent.status === "complete" || agent.status === "error"
          );

          if (allComplete) {
            stopPolling();
            setStatus("complete");
          } else {
            pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
          }
        } catch (err) {
          stopPolling();
          setStatus("error");
          setError(
            err instanceof Error ? err.message : "Failed to fetch analysis results"
          );
        }
      };

      setStatus("polling");
      poll();
    },
    [stopPolling]
  );

  const submit = useCallback(
    async (request: AnalysisRequest) => {
      stopPolling();
      setStatus("submitting");
      setError(null);
      setResult(null);

      try {
        const response = await apiClient.submitAnalysis(request);
        const analysis = response.data;

        setResult(analysis);
        pollForResult(analysis.id);
      } catch (err) {
        setStatus("error");
        setError(
          err instanceof Error ? err.message : "Failed to submit analysis"
        );
      }
    },
    [stopPolling, pollForResult]
  );

  const reset = useCallback(() => {
    stopPolling();
    setResult(null);
    setStatus("idle");
    setError(null);
  }, [stopPolling]);

  return { result, status, error, submit, reset };
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient } from "@/lib/api-client";

export function useAnonymousSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const id = await apiClient.ensureSession();
      setSessionId(id);
      setIsLoading(false);
      return id;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to initialize anonymous session.";
      setError(msg);
      setIsLoading(false);
      return null;
    }
  }, []);

  useEffect(() => {
    initSession();
  }, [initSession]);

  return { sessionId, isLoading, error, refreshSession: initSession };
}

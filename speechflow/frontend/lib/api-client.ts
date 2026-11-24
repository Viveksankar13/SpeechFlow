/**
 * Typed API client for SpeechFlow backend.
 * All requests include credentials (cookies) and fallback session ID headers.
 */
import type {
  Transcription,
  AnonymousSessionResponse,
  WSTokenResponse,
  PaginatedResponse,
  APIError,
} from "@/types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

const SESSION_STORAGE_KEY = "speechflow_session_id";

export function getStoredSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredSessionId(sessionId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } catch {
    // Ignore storage failure
  }
}

export function clearStoredSessionId(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

class APIClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  getStoredSessionId(): string | null {
    return getStoredSessionId();
  }

  setStoredSessionId(sessionId: string): void {
    setStoredSessionId(sessionId);
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    const storedSid = getStoredSessionId();
    if (storedSid && !headers["x-session-id"]) {
      headers["x-session-id"] = storedSid;
    }

    const response = await fetch(url, {
      ...options,
      credentials: "include", // Always send cookies
      headers,
    });

    if (!response.ok) {
      let errorBody: APIError | null = null;
      try {
        errorBody = await response.json();
      } catch {
        // Ignore parse error
      }
      const message =
        errorBody?.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(message);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  // --- Health ---
  async checkHealth(): Promise<{ status: string; database?: string }> {
    return this.request<{ status: string; database?: string }>("/health/ready");
  }

  // --- Session ---
  async createAnonymousSession(): Promise<AnonymousSessionResponse> {
    const session = await this.request<AnonymousSessionResponse>(
      "/api/v1/anonymous-session",
      { method: "POST" }
    );
    if (session?.session_id) {
      setStoredSessionId(session.session_id);
    }
    return session;
  }

  async getAnonymousSession(): Promise<AnonymousSessionResponse> {
    const session = await this.request<AnonymousSessionResponse>("/api/v1/anonymous-session");
    if (session?.session_id) {
      setStoredSessionId(session.session_id);
    }
    return session;
  }

  async ensureSession(): Promise<string> {
    const stored = getStoredSessionId();
    if (stored) {
      try {
        const session = await this.getAnonymousSession();
        return session.session_id;
      } catch {
        // Stored session might be invalid or expired
      }
    }
    // No stored session or expired -> create new one directly (POST 201) without generating a 401 error
    const newSession = await this.createAnonymousSession();
    return newSession.session_id;
  }

  async getWSToken(): Promise<WSTokenResponse> {
    return this.request<WSTokenResponse>("/api/v1/ws-token");
  }

  // --- Transcriptions ---
  async createTranscription(data: {
    title?: string;
    language_mode?: string;
    transcription_mode?: string;
  }): Promise<Transcription> {
    return this.request<Transcription>("/api/v1/transcriptions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getTranscriptions(params?: {
    page?: number;
    page_size?: number;
    search?: string;
    sort?: string;
    status?: string;
  }): Promise<PaginatedResponse<Transcription>> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.page_size) qs.set("page_size", String(params.page_size));
    if (params?.search) qs.set("search", params.search);
    if (params?.sort) {
      const normalizedSort =
        params.sort === "-created_at"
          ? "created_at_desc"
          : params.sort === "created_at"
          ? "created_at_asc"
          : params.sort;
      qs.set("sort", normalizedSort);
    }
    if (params?.status) qs.set("status", params.status);
    const query = qs.toString() ? `?${qs}` : "";
    return this.request<PaginatedResponse<Transcription>>(
      `/api/v1/transcriptions${query}`
    );
  }

  async getTranscription(id: string): Promise<Transcription> {
    return this.request<Transcription>(`/api/v1/transcriptions/${id}`);
  }

  async updateTranscription(
    id: string,
    data: Partial<Pick<Transcription, "title" | "transcript_text">>
  ): Promise<Transcription> {
    return this.request<Transcription>(`/api/v1/transcriptions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async saveTranscription(
    id: string,
    data?: Partial<Pick<Transcription, "title" | "transcript_text">>
  ): Promise<Transcription> {
    return this.request<Transcription>(
      `/api/v1/transcriptions/${id}/save`,
      { method: "POST", body: JSON.stringify(data || {}) }
    );
  }

  async deleteTranscription(id: string): Promise<void> {
    return this.request<void>(`/api/v1/transcriptions/${id}`, {
      method: "DELETE",
    });
  }
}

export const apiClient = new APIClient(BASE_URL);

/**
 * Derive WebSocket URL from the API base URL.
 * http → ws, https → wss
 */
export function getWebSocketUrl(path: string): string {
  const wsBase = BASE_URL.replace(/^http/, "ws");
  return `${wsBase}${path}`;
}

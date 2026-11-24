// ============================================================
// SpeechFlow — Shared TypeScript Types
// ============================================================

// --- Recording States ---
export type RecordingState =
  | "idle"
  | "requesting_permission"
  | "connecting"
  | "recording"
  | "paused"
  | "reconnecting"
  | "finalizing"
  | "completed"
  | "error";

// --- Language & Transcription Mode ---
export type LanguageMode = "auto" | "en-IN" | "hi-IN" | "ml-IN";
export type TranscriptionMode = "VERBATIM" | "SMART";
export type RecordingStatus = "draft" | "recording" | "paused" | "completed" | "failed";
export type SaveMethod = "automatic" | "manual" | "system";
export type SaveState = "idle" | "saving" | "saved_auto" | "saved_manual" | "unsaved" | "error";

// --- API Response Types ---
export interface Transcription {
  id: string;
  title: string;
  transcript_text: string;
  detected_language: string | null;
  language_label: string | null;
  transcription_mode: TranscriptionMode;
  recording_status: RecordingStatus;
  duration_ms: number | null;
  save_method: SaveMethod | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface AnonymousSessionResponse {
  session_id: string;
  expires_at: string;
}

export interface WSTokenResponse {
  ws_token: string;
  expires_in_seconds: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface APIError {
  error: string;
  message: string;
}

// --- WebSocket Event Types (server → client) ---
export type WSEventType =
  | "ready"
  | "interim_transcript"
  | "final_transcript"
  | "recording_status"
  | "saved"
  | "completed"
  | "pong"
  | "error";

export interface WSReadyEvent {
  type: "ready";
  transcription_id: string;
}

export interface WSInterimEvent {
  type: "interim_transcript";
  text: string;
}

export interface WSFinalEvent {
  type: "final_transcript";
  segment_text: string;
  transcript_text: string;
}

export interface WSStatusEvent {
  type: "recording_status";
  status: RecordingState;
}

export interface WSSavedEvent {
  type: "saved";
  save_method: SaveMethod;
  transcription_id: string;
}

export interface WSCompletedEvent {
  type: "completed";
  transcription_id: string;
  transcript_text: string;
}

export interface WSPongEvent {
  type: "pong";
}

export interface WSErrorEvent {
  type: "error";
  code: string;
  message: string;
}

export type WSEvent =
  | WSReadyEvent
  | WSInterimEvent
  | WSFinalEvent
  | WSStatusEvent
  | WSSavedEvent
  | WSCompletedEvent
  | WSPongEvent
  | WSErrorEvent;

// --- WebSocket Client Messages (client → server) ---
export interface WSStartMessage {
  type: "start";
  transcription_id: string;
  language_mode: LanguageMode;
  transcription_mode: TranscriptionMode;
}

export interface WSPauseMessage {
  type: "pause";
}

export interface WSResumeMessage {
  type: "resume";
}

export interface WSStopMessage {
  type: "stop";
}

export interface WSPingMessage {
  type: "ping";
}

export type WSClientMessage =
  | WSStartMessage
  | WSPauseMessage
  | WSResumeMessage
  | WSStopMessage
  | WSPingMessage;

// --- Language Options ---
export const LANGUAGE_OPTIONS: { value: LanguageMode; label: string }[] = [
  { value: "auto", label: "Auto Detect" },
  { value: "en-IN", label: "English" },
  { value: "hi-IN", label: "Hindi" },
  { value: "ml-IN", label: "Malayalam" },
];

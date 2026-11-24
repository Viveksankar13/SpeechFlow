"use client";

import { useRef, useCallback, useEffect } from "react";
import { apiClient, getWebSocketUrl } from "@/lib/api-client";
import type {
  WSEvent,
  WSStartMessage,
  WSPauseMessage,
  WSResumeMessage,
  WSStopMessage,
  WSPingMessage,
  LanguageMode,
  TranscriptionMode,
} from "@/types";

interface UseTranscriptionSocketOptions {
  onReady?: (transcriptionId: string) => void;
  onInterim?: (text: string) => void;
  onFinal?: (segmentText: string, fullTranscript: string) => void;
  onStatusChange?: (status: string) => void;
  onSaved?: (transcriptionId: string, method: string) => void;
  onCompleted?: (transcriptionId: string, fullTranscript: string) => void;
  onError?: (code: string, message: string) => void;
  onDisconnect?: () => void;
}

export function useTranscriptionSocket(options: UseTranscriptionSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const connect = useCallback(async (): Promise<void> => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // 1. Fetch short-lived single-use WebSocket token
    const { ws_token } = await apiClient.getWSToken();

    // 2. Derive WebSocket URL and connect
    const wsUrl = getWebSocketUrl(`/api/v1/ws/transcribe?token=${encodeURIComponent(ws_token)}`);
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("WebSocket connection to backend timed out after 10s."));
      }, 10000);

      ws.onopen = () => {
        clearTimeout(timeoutId);
        // Start 30s heartbeat ping
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const ping: WSPingMessage = { type: "ping" };
            ws.send(JSON.stringify(ping));
          }
        }, 30000);

        resolve();
      };

      ws.onerror = (err) => {
        clearTimeout(timeoutId);
        reject(err);
      };

      ws.onclose = () => {
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        optionsRef.current.onDisconnect?.();
      };

      ws.onmessage = (event: MessageEvent) => {
        // Server messages are JSON
        if (typeof event.data === "string") {
          try {
            const data = JSON.parse(event.data) as WSEvent;
            switch (data.type) {
              case "ready":
                optionsRef.current.onReady?.(data.transcription_id);
                break;
              case "interim_transcript":
                optionsRef.current.onInterim?.(data.text);
                break;
              case "final_transcript":
                optionsRef.current.onFinal?.(data.segment_text, data.transcript_text);
                break;
              case "recording_status":
                optionsRef.current.onStatusChange?.(data.status);
                break;
              case "saved":
                optionsRef.current.onSaved?.(data.transcription_id, data.save_method);
                break;
              case "completed":
                optionsRef.current.onCompleted?.(data.transcription_id, data.transcript_text);
                if (wsRef.current === ws) {
                  ws.close(1000, "Recording completed");
                  wsRef.current = null;
                }
                break;
              case "error":
                optionsRef.current.onError?.(data.code, data.message);
                break;
              case "pong":
                // Heartbeat acknowledged
                break;
            }
          } catch {
            // Ignore malformed JSON
          }
        }
      };
    });
  }, []);

  const sendAudioChunk = useCallback((chunk: ArrayBuffer) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(chunk);
    }
  }, []);

  const sendStart = useCallback(
    (transcriptionId: string, languageMode: LanguageMode, transcriptionMode: TranscriptionMode) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const msg: WSStartMessage = {
          type: "start",
          transcription_id: transcriptionId,
          language_mode: languageMode,
          transcription_mode: transcriptionMode,
        };
        wsRef.current.send(JSON.stringify(msg));
      }
    },
    []
  );

  const sendPause = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const msg: WSPauseMessage = { type: "pause" };
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const sendResume = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const msg: WSResumeMessage = { type: "resume" };
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const sendStop = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const msg: WSStopMessage = { type: "stop" };
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    sendAudioChunk,
    sendStart,
    sendPause,
    sendResume,
    sendStop,
  };
}

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { saveAudioToDB } from "@/lib/audio-storage";
import { useMicrophone } from "@/hooks/useMicrophone";
import { useAudioStream } from "@/hooks/useAudioStream";
import { useTranscriptionSocket } from "@/hooks/useTranscriptionSocket";
import type {
  RecordingState,
  LanguageMode,
  TranscriptionMode,
  SaveState,
} from "@/types";

export function useRecording() {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [transcriptionId, setTranscriptionId] = useState<string | null>(null);
  const [title, setTitle] = useState("Untitled Recording");
  const [interimText, setInterimText] = useState("");
  const [finalText, setFinalText] = useState("");
  const [languageMode, setLanguageMode] = useState<LanguageMode>("auto");
  const [transcriptionMode, setTranscriptionMode] = useState<TranscriptionMode>("VERBATIM");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio recording state for playback
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriptionIdRef = useRef<string | null>(null);

  // Timer state
  const [durationSeconds, setDurationSeconds] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { requestMicrophone, releaseMicrophone, error: micError } = useMicrophone();
  const { startAudioProcessing, stopAudioProcessing } = useAudioStream();

  // Socket event callbacks
  const socket = useTranscriptionSocket({
    onReady: () => {
      setRecordingState("recording");
      // Start duration timer
      timerIntervalRef.current = setInterval(() => {
        setDurationSeconds((s) => s + 1);
      }, 1000);
    },
    onInterim: (text) => {
      setInterimText(text);
    },
    onFinal: (segment, fullTranscript) => {
      setFinalText(fullTranscript);
      setInterimText("");
    },
    onStatusChange: (status) => {
      if (status === "paused") {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      } else if (status === "recording") {
        if (!timerIntervalRef.current) {
          timerIntervalRef.current = setInterval(() => {
            setDurationSeconds((s) => s + 1);
          }, 1000);
        }
      }
      setRecordingState(status as RecordingState);
    },
    onSaved: () => {
      setSaveState("saved_auto");
    },
    onCompleted: (_, fullTranscript) => {
      setFinalText(fullTranscript);
      setInterimText("");
      setRecordingState("completed");
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    },
    onError: (code, message) => {
      setErrorMessage(`[${code}] ${message}`);
      setRecordingState("error");
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    },
    onDisconnect: () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    },
  });

  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    setInterimText("");
    setFinalText("");
    setSaveState("idle");
    setDurationSeconds(0);
    setRecordingState("requesting_permission");

    // Reset previous playback audio
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setAudioBlob(null);
    audioChunksRef.current = [];

    // 1. Ensure anonymous session is active before starting
    try {
      await apiClient.ensureSession();
    } catch {
      setErrorMessage(
        "Cannot connect to the backend server. Please ensure the FastAPI backend is running on http://localhost:8000."
      );
      setRecordingState("error");
      return;
    }

    // 2. Request microphone
    const stream = await requestMicrophone();
    if (!stream) {
      setErrorMessage(
        "Microphone access could not be acquired. Please ensure microphone permissions are granted in your browser address bar and a working microphone is selected."
      );
      setRecordingState("error");
      return;
    }

    // 3. Initialize local MediaRecorder for audio playback
    try {
      const supportedMime = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg",
      ].find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type));

      const mr = supportedMime
        ? new MediaRecorder(stream, { mimeType: supportedMime })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      mr.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mr.start(250);
      mediaRecorderRef.current = mr;
    } catch (mrErr) {
      console.warn("Could not start MediaRecorder for local playback:", mrErr);
    }

    try {
      setRecordingState("connecting");

      // 4. Create database transcription record
      const defaultTitle = `Recording — ${new Date().toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`;
      const record = await apiClient.createTranscription({
        title: defaultTitle,
        language_mode: languageMode,
        transcription_mode: transcriptionMode,
      });

      setTranscriptionId(record.id);
      transcriptionIdRef.current = record.id;
      setTitle(record.title);

      // 5. Connect WebSocket
      await socket.connect();

      // 6. Send start control message to initiate Gemini streaming session
      socket.sendStart(record.id, languageMode, transcriptionMode);

      // 7. Start audio worklet processing and streaming chunks
      await startAudioProcessing(stream, (chunk) => {
        socket.sendAudioChunk(chunk);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start recording.";
      let userFriendlyMsg = msg;
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        userFriendlyMsg =
          "Cannot reach backend server. Please verify the FastAPI backend is running on http://localhost:8000.";
      }
      setErrorMessage(userFriendlyMsg);
      setRecordingState("error");
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore
        }
      }
      releaseMicrophone();
      await stopAudioProcessing();
    }
  }, [
    audioUrl,
    languageMode,
    transcriptionMode,
    requestMicrophone,
    releaseMicrophone,
    socket,
    startAudioProcessing,
    stopAudioProcessing,
  ]);

  const pauseRecording = useCallback(() => {
    socket.sendPause();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      try {
        mediaRecorderRef.current.pause();
      } catch {
        // Ignore
      }
    }
    setRecordingState("paused");
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, [socket]);

  const resumeRecording = useCallback(() => {
    socket.sendResume();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      try {
        mediaRecorderRef.current.resume();
      } catch {
        // Ignore
      }
    }
    setRecordingState("recording");
    timerIntervalRef.current = setInterval(() => {
      setDurationSeconds((s) => s + 1);
    }, 1000);
  }, [socket]);

  const stopRecording = useCallback(async () => {
    setRecordingState("finalizing");
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Finalize MediaRecorder to produce playable audio Blob & URL
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      const mr = mediaRecorderRef.current;
      await new Promise<void>((resolve) => {
        mr.onstop = () => {
          try {
            const mime = mr.mimeType || "audio/webm";
            const blob = new Blob(audioChunksRef.current, { type: mime });
            const url = URL.createObjectURL(blob);
            setAudioBlob(blob);
            setAudioUrl(url);
            const currentId = transcriptionIdRef.current;
            if (currentId) {
              saveAudioToDB(currentId, blob);
            }
          } catch (blobErr) {
            console.warn("Error finalizing audio recording blob:", blobErr);
          }
          resolve();
        };
        mr.stop();
      });
    }

    // Stop audio worklet and release microphone immediately
    await stopAudioProcessing();
    releaseMicrophone();

    // Signal stop to backend over WebSocket
    socket.sendStop();
  }, [socket, stopAudioProcessing, releaseMicrophone]);

  const clearTranscript = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setAudioBlob(null);
    audioChunksRef.current = [];
    setInterimText("");
    setFinalText("");
    setDurationSeconds(0);
    setRecordingState("idle");
    setTranscriptionId(null);
    transcriptionIdRef.current = null;
  }, [audioUrl]);

  const manualSave = useCallback(
    async (newTitle?: string, newText?: string) => {
      if (!transcriptionId) return;
      setSaveState("saving");
      try {
        const textToSave = newText !== undefined ? newText : finalText;
        const titleToSave = newTitle !== undefined ? newTitle : title;
        await apiClient.saveTranscription(transcriptionId, {
          title: titleToSave,
          transcript_text: textToSave,
        });
        setSaveState("saved_manual");
        if (newTitle) setTitle(newTitle);
        if (newText !== undefined) setFinalText(newText);
      } catch (err) {
        setSaveState("error");
        setErrorMessage(err instanceof Error ? err.message : "Manual save failed.");
      }
    },
    [transcriptionId, finalText, title]
  );

  useEffect(() => {
    if (micError) {
      setErrorMessage(micError);
    }
  }, [micError]);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  return {
    recordingState,
    transcriptionId,
    title,
    setTitle,
    interimText,
    finalText,
    setFinalText,
    durationSeconds,
    languageMode,
    setLanguageMode,
    transcriptionMode,
    setTranscriptionMode,
    saveState,
    errorMessage,
    audioUrl,
    audioBlob,
    setAudioUrl,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    clearTranscript,
    manualSave,
  };
}

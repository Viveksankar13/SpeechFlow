"use client";

import { useState, useCallback, useRef } from "react";

export type PermissionStatus = "prompt" | "granted" | "denied" | "unsupported";

export function useMicrophone() {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>("prompt");
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const requestMicrophone = useCallback(async (): Promise<MediaStream | null> => {
    setError(null);

    // 1. Check API support
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const msg = "Audio recording is not supported in this browser environment.";
      setError(msg);
      setPermissionStatus("unsupported");
      return null;
    }

    // 2. Check HTTPS context (getUserMedia requires secure context except localhost)
    if (
      window.location.protocol !== "https:" &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      const msg = "Microphone access requires a secure connection (HTTPS).";
      setError(msg);
      setPermissionStatus("denied");
      return null;
    }

    try {
      // 3. Request user media with optimal speech constraints, falling back to basic audio if needed
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch {
        // Fallback to basic audio constraint if enhanced constraints fail on this hardware
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      streamRef.current = stream;
      setPermissionStatus("granted");
      return stream;
    } catch (err: unknown) {
      let message = "Could not access microphone.";
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          message = "Microphone permission was denied. Please allow microphone access in your browser settings.";
          setPermissionStatus("denied");
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          message = "No microphone found on this device.";
          setPermissionStatus("unsupported");
        } else if (err.name === "NotReadableError") {
          message = "Microphone is currently in use by another application.";
          setPermissionStatus("denied");
        }
      }
      setError(message);
      return null;
    }
  }, []);

  const releaseMicrophone = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  return {
    permissionStatus,
    error,
    requestMicrophone,
    releaseMicrophone,
  };
}

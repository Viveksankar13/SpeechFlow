"use client";

import type { RecordingState } from "@/types";
import { Mic, Square, Pause, Play, Loader2 } from "lucide-react";

interface RecordingControlsProps {
  recordingState: RecordingState;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export function RecordingControls({
  recordingState,
  onStart,
  onPause,
  onResume,
  onStop,
}: RecordingControlsProps) {
  const isRecording = recordingState === "recording";
  const isPaused = recordingState === "paused";
  const isConnecting = recordingState === "connecting" || recordingState === "requesting_permission";
  const isFinalizing = recordingState === "finalizing";
  const isBusy = isRecording || isPaused || isConnecting || isFinalizing;

  return (
    <div className="flex items-center justify-center gap-4 py-2">
      {!isBusy ? (
        // Start Recording Button
        <button
          onClick={onStart}
          className="relative group px-8 py-4 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-base shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Mic className="w-5 h-5 text-white" />
          </div>
          <span>Start Recording</span>
        </button>
      ) : (
        <div className="flex items-center gap-3">
          {/* Pause / Resume Button */}
          {isRecording && (
            <button
              onClick={onPause}
              title="Pause Recording"
              className="px-5 py-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium text-sm flex items-center gap-2 border border-gray-300 transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <Pause className="w-4 h-4 text-gray-700" />
              <span>Pause</span>
            </button>
          )}

          {isPaused && (
            <button
              onClick={onResume}
              title="Resume Recording"
              className="px-5 py-3 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium text-sm flex items-center gap-2 border border-emerald-300 transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <Play className="w-4 h-4 text-emerald-700 fill-emerald-700" />
              <span>Resume</span>
            </button>
          )}

          {/* Stop Recording Button */}
          <button
            onClick={onStop}
            disabled={isConnecting || isFinalizing}
            className="px-6 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-medium text-sm flex items-center gap-2 shadow-md shadow-red-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isFinalizing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Finalizing...</span>
              </>
            ) : isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Square className="w-4 h-4 fill-white" />
                <span>Stop Recording</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

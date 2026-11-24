"use client";

import type { RecordingState } from "@/types";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface RecordingStatusBadgeProps {
  status: RecordingState;
}

export function RecordingStatusBadge({ status }: RecordingStatusBadgeProps) {
  switch (status) {
    case "recording":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
          Recording Live
        </span>
      );
    case "paused":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          Paused
        </span>
      );
    case "connecting":
    case "requesting_permission":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
          {status === "requesting_permission" ? "Requesting Microphone..." : "Connecting to Gemini..."}
        </span>
      );
    case "reconnecting":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          <Loader2 className="w-3 h-3 animate-spin text-purple-600" />
          Reconnecting Session...
        </span>
      );
    case "finalizing":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
          Finalizing Transcript...
        </span>
      );
    case "completed":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Completed
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertCircle className="w-3 h-3 text-rose-600" />
          Error
        </span>
      );
    case "idle":
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
          <span className="w-2 h-2 rounded-full bg-gray-400"></span>
          Ready to Record
        </span>
      );
  }
}

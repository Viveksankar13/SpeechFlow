"use client";

import Link from "next/link";
import {
  Clock,
  Globe,
  Trash2,
  FileText,
  Download,
  ExternalLink,
  Save,
} from "lucide-react";
import type { Transcription } from "@/types";

interface TranscriptionCardProps {
  transcription: Transcription;
  onDelete: (transcription: Transcription) => void;
  onExportTxt: (transcription: Transcription) => void;
}

export function TranscriptionCard({
  transcription,
  onDelete,
  onExportTxt,
}: TranscriptionCardProps) {
  // Format duration
  const formatDuration = (ms: number | null): string => {
    if (!ms || ms <= 0) return "00:00";
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Format relative date without external dependencies
  const formatRelativeTime = (isoString: string): string => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return "just now";
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 30) return `${diffDays}d ago`;
      return new Date(isoString).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "recently";
    }
  };

  // Status badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "recording":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
            In Progress
          </span>
        );
      case "paused":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Paused
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Completed
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            Draft
          </span>
        );
    }
  };

  // Word count
  const wordCount = transcription.transcript_text
    ? transcription.transcript_text.trim().split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group">
      <div className="p-5">
        {/* Top meta row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          {getStatusBadge(transcription.recording_status)}
          <span className="text-xs text-gray-400 font-mono">
            {formatRelativeTime(transcription.created_at)}
          </span>
        </div>

        {/* Title */}
        <Link
          href={`/transcriptions/${transcription.id}`}
          className="block group-hover:text-blue-600 transition-colors"
        >
          <h3 className="font-semibold text-base text-gray-900 line-clamp-1 mb-2">
            {transcription.title || "Untitled Recording"}
          </h3>
        </Link>

        {/* Text Preview */}
        <p className="text-sm text-gray-600 line-clamp-3 mb-4 min-h-[4rem] font-sans leading-relaxed">
          {transcription.transcript_text ? (
            transcription.transcript_text
          ) : (
            <span className="text-gray-400 italic">No transcript recorded yet...</span>
          )}
        </p>

        {/* Info badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span>{formatDuration(transcription.duration_ms)}</span>
          </div>

          <span className="text-gray-300">•</span>

          <div className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-gray-400" />
            <span>{wordCount} words</span>
          </div>

          <span className="text-gray-300">•</span>

          <div className="flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-gray-400" />
            <span>{transcription.detected_language || "Auto"}</span>
          </div>

          {transcription.save_method && (
            <>
              <span className="text-gray-300">•</span>
              <div className="flex items-center gap-1 text-gray-400">
                <Save className="w-3 h-3" />
                <span className="capitalize">{transcription.save_method}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="bg-gray-50/70 px-5 py-3 border-t border-gray-100 flex items-center justify-between">
        <Link
          href={`/transcriptions/${transcription.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
        >
          <span>View & Edit</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onExportTxt(transcription)}
            title="Download .txt"
            aria-label="Download transcription text file"
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-md transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(transcription)}
            title="Delete transcription"
            aria-label="Delete transcription"
            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

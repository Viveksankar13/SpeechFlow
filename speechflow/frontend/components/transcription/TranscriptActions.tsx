"use client";

import { useState } from "react";
import type { SaveState } from "@/types";
import { Copy, Check, Download, Trash2, Save, Cloud, Loader2, Music } from "lucide-react";

interface TranscriptActionsProps {
  transcriptText: string;
  title: string;
  saveState: SaveState;
  onSave: () => void;
  onClear: () => void;
  isRecording: boolean;
  audioUrl?: string | null;
}

export function TranscriptActions({
  transcriptText,
  title,
  saveState,
  onSave,
  onClear,
  isRecording,
  audioUrl,
}: TranscriptActionsProps) {
  const [copied, setCopied] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const hasContent = transcriptText.trim().length > 0;

  const handleCopy = async () => {
    if (!hasContent) return;
    try {
      await navigator.clipboard.writeText(transcriptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownload = () => {
    if (!hasContent) return;
    const blob = new Blob([transcriptText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAudio = () => {
    if (!audioUrl) return;
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
      {/* Save Status Badge */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
        {saveState === "saving" && (
          <span className="flex items-center gap-1 text-blue-600">
            <Loader2 className="w-3 h-3 animate-spin" />
            Saving changes...
          </span>
        )}
        {saveState === "saved_auto" && (
          <span className="flex items-center gap-1 text-emerald-600">
            <Cloud className="w-3 h-3" />
            Autosaved
          </span>
        )}
        {saveState === "saved_manual" && (
          <span className="flex items-center gap-1 text-emerald-600">
            <Check className="w-3 h-3" />
            Saved manually
          </span>
        )}
        {saveState === "error" && (
          <span className="text-rose-600">Save failed</span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Copy Button */}
        <button
          onClick={handleCopy}
          disabled={!hasContent}
          title="Copy transcript to clipboard"
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-gray-500" />
              <span>Copy</span>
            </>
          )}
        </button>

        {/* Download Text Button */}
        <button
          onClick={handleDownload}
          disabled={!hasContent}
          title="Download as .txt"
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-gray-500" />
          <span>Export .txt</span>
        </button>

        {/* Download Audio Button */}
        {audioUrl && (
          <button
            onClick={handleDownloadAudio}
            title="Download audio recording (.webm)"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Music className="w-3.5 h-3.5 text-indigo-600" />
            <span>Export Audio</span>
          </button>
        )}

        {/* Manual Save Button */}
        <button
          onClick={onSave}
          disabled={!hasContent || saveState === "saving"}
          title="Save transcript manually"
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save</span>
        </button>

        {/* Clear Button */}
        {!showClearConfirm ? (
          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={(!hasContent && !audioUrl) || isRecording}
            title="Clear transcript & recording"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex items-center gap-1 bg-red-50 px-2 py-1 rounded-lg border border-red-200">
            <span className="text-xs text-red-700 font-medium">Clear?</span>
            <button
              onClick={() => {
                onClear();
                setShowClearConfirm(false);
              }}
              className="text-xs font-bold text-red-600 hover:text-red-800 px-1 cursor-pointer"
            >
              Yes
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              className="text-xs text-gray-500 hover:text-gray-700 px-1 cursor-pointer"
            >
              No
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

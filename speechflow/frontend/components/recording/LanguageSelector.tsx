"use client";

import type { LanguageMode, TranscriptionMode } from "@/types";
import { LANGUAGE_OPTIONS } from "@/types";
import { Globe, Wand2 } from "lucide-react";

interface LanguageSelectorProps {
  languageMode: LanguageMode;
  onLanguageChange: (mode: LanguageMode) => void;
  transcriptionMode: TranscriptionMode;
  onTranscriptionModeChange: (mode: TranscriptionMode) => void;
  disabled?: boolean;
}

export function LanguageSelector({
  languageMode,
  onLanguageChange,
  transcriptionMode,
  onTranscriptionModeChange,
  disabled = false,
}: LanguageSelectorProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-gray-100">
      {/* Language Selector */}
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-gray-500" />
        <label htmlFor="language-select" className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
          Language:
        </label>
        <select
          id="language-select"
          value={languageMode}
          onChange={(e) => onLanguageChange(e.target.value as LanguageMode)}
          disabled={disabled}
          className="text-sm font-medium text-gray-800 bg-white border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* SMART Mode Toggle */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Wand2 className={`w-3.5 h-3.5 ${transcriptionMode === "SMART" ? "text-indigo-600" : "text-gray-400"}`} />
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
            Smart Formatting:
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={transcriptionMode === "SMART"}
          disabled={disabled}
          onClick={() =>
            onTranscriptionModeChange(transcriptionMode === "SMART" ? "VERBATIM" : "SMART")
          }
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            transcriptionMode === "SMART" ? "bg-indigo-600" : "bg-gray-200"
          }`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              transcriptionMode === "SMART" ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
        <span className="text-xs text-gray-500 font-mono">
          {transcriptionMode === "SMART" ? "Cleaned" : "Verbatim"}
        </span>
      </div>
    </div>
  );
}

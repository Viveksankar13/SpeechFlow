"use client";

import { useEffect, useRef } from "react";
import type { RecordingState } from "@/types";
import { Mic, Waves } from "lucide-react";

interface TranscriptDisplayProps {
  finalText: string;
  interimText: string;
  recordingState: RecordingState;
}

export function TranscriptDisplay({
  finalText,
  interimText,
  recordingState,
}: TranscriptDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);

  // Compute stats
  const fullText = (finalText + (interimText ? " " + interimText : "")).trim();
  const wordCount = fullText ? fullText.split(/\s+/).filter(Boolean).length : 0;
  const charCount = fullText.length;

  const isRecording = recordingState === "recording";
  const hasContent = finalText.trim().length > 0 || interimText.trim().length > 0;

  // Auto-scroll when new text arrives, unless user scrolled up
  useEffect(() => {
    if (!containerRef.current || isUserScrollingRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [finalText, interimText]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    // If within 50px of bottom, consider user as following the live stream
    isUserScrollingRef.current = scrollHeight - (scrollTop + clientHeight) > 50;
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Transcription Content Area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 p-6 overflow-y-auto min-h-[300px] max-h-[500px] scroll-smooth font-sans text-base leading-relaxed text-gray-800"
      >
        {!hasContent && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center border border-gray-100">
              <Mic className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <p className="font-medium text-gray-600 text-sm">No speech captured yet</p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                Press <span className="font-semibold text-blue-600">Start Recording</span> and speak in
                English, Hindi, Malayalam, or mix them naturally.
              </p>
            </div>
          </div>
        )}

        {hasContent && (
          <div className="space-y-2 whitespace-pre-wrap select-text">
            {/* Finalized text */}
            {finalText && (
              <span className="text-gray-900 font-normal">{finalText}</span>
            )}

            {/* Interim live preview text */}
            {interimText && (
              <span className="text-indigo-600/90 italic ml-1 bg-indigo-50/60 px-1.5 py-0.5 rounded transition-all">
                {interimText}
              </span>
            )}

            {/* Live audio wave indicator */}
            {isRecording && (
              <span className="inline-flex items-center ml-2 text-indigo-500 animate-pulse">
                <Waves className="w-4 h-4 inline" />
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer Word & Char Counts */}
      <div className="px-6 py-2.5 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span>
            Words: <strong className="font-semibold text-gray-700">{wordCount}</strong>
          </span>
          <span>•</span>
          <span>
            Characters: <strong className="font-semibold text-gray-700">{charCount}</strong>
          </span>
        </div>
        {interimText && (
          <span className="text-indigo-600 font-medium text-xs flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping"></span>
            Transcribing live...
          </span>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, use, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Trash2,
  Download,
  Copy,
  Check,
  Clock,
  Globe,
  FileText,
  Loader2,
  AlertCircle,
  Calendar,
  Sparkles,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { DeleteConfirmModal } from "@/components/dashboard/DeleteConfirmModal";
import { AudioPlayer } from "@/components/common/AudioPlayer";
import { getAudioFromDB } from "@/lib/audio-storage";
import { apiClient } from "@/lib/api-client";
import type { Transcription } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

function DetailContent({ params }: PageProps) {
  const resolvedParams = use(params);
  const transcriptionId = resolvedParams.id;
  const router = useRouter();

  const [transcription, setTranscription] = useState<Transcription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable local state
  const [title, setTitle] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Deletion modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Load transcription detail
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        await apiClient.ensureSession();
        const data = await apiClient.getTranscription(transcriptionId);
        if (isMounted) {
          setTranscription(data);
          setTitle(data.title || "Untitled Recording");
          setTranscriptText(data.transcript_text || "");
        }
        // Load audio recording from local IndexedDB if present
        getAudioFromDB(transcriptionId).then((blob) => {
          if (blob && isMounted) {
            setAudioUrl(URL.createObjectURL(blob));
          }
        });
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : "Failed to load transcription";
          setError(msg);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [transcriptionId]);

  // Revoke object URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Track if there are unsaved edits
  const hasUnsavedChanges =
    transcription &&
    (title !== (transcription.title || "Untitled Recording") ||
      transcriptText !== (transcription.transcript_text || ""));

  // Save changes handler
  const handleSave = async () => {
    if (!transcription) return;
    setIsSaving(true);
    try {
      const updated = await apiClient.saveTranscription(transcription.id, {
        title: title.trim(),
        transcript_text: transcriptText,
      });
      setTranscription(updated);
      setTitle(updated.title);
      setTranscriptText(updated.transcript_text);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save changes";
      alert(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Copy to clipboard
  const handleCopy = async () => {
    if (!transcriptText) return;
    try {
      await navigator.clipboard.writeText(transcriptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Failed to copy to clipboard.");
    }
  };

  // Export .txt file
  const handleExportTxt = () => {
    const text = transcriptText || "(Empty transcript)";
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeTitle = (title || "transcription").replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
    a.href = url;
    a.download = `${safeTitle}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Delete handler
  const handleDeleteConfirm = async () => {
    if (!transcription) return;
    setIsDeleting(true);
    try {
      await apiClient.deleteTranscription(transcription.id);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete transcription";
      alert(msg);
      setIsDeleting(false);
    }
  };

  // Format duration
  const formatDuration = (ms: number | null): string => {
    if (!ms || ms <= 0) return "00:00";
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Format date
  const formatDate = (isoString: string): string => {
    try {
      return new Date(isoString).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return isoString;
    }
  };

  // Word & character stats
  const wordCount = transcriptText
    ? transcriptText.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const charCount = transcriptText.length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to History</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading transcription details...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-sm max-w-md mx-auto">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Transcription Not Found
            </h3>
            <p className="text-sm text-gray-500 mb-6">{error}</p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Dashboard</span>
            </Link>
          </div>
        )}

        {/* Transcription Editor & Details */}
        {!loading && transcription && (
          <div className="space-y-6 animate-fade-in">
            {/* Title Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <label
                htmlFor="transcription-title"
                className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2"
              >
                Recording Title
              </label>
              <input
                id="transcription-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give this recording a title..."
                className="w-full text-xl sm:text-2xl font-bold text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none py-1 transition-colors bg-transparent"
              />

              {/* Metadata Badges */}
              <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
                <div className="flex items-center gap-1.5 font-medium">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span>Duration: {formatDuration(transcription.duration_ms)}</span>
                </div>

                <span className="text-gray-300">•</span>

                <div className="flex items-center gap-1.5 font-medium">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>Created: {formatDate(transcription.created_at)}</span>
                </div>

                <span className="text-gray-300">•</span>

                <div className="flex items-center gap-1.5 font-medium">
                  <Globe className="w-4 h-4 text-gray-400" />
                  <span>Language: {transcription.detected_language || "Auto Detect"}</span>
                </div>

                <span className="text-gray-300">•</span>

                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  <span>{transcription.transcription_mode || "VERBATIM"}</span>
                </div>

                {transcription.save_method && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="text-gray-400">
                      Save mode:{" "}
                      <strong className="text-gray-600 font-semibold capitalize">
                        {transcription.save_method}
                      </strong>
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Audio Playback Player */}
            {audioUrl && (
              <AudioPlayer audioUrl={audioUrl} title={title} />
            )}

            {/* Transcript Editor */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
              {/* Editor Toolbar */}
              <div className="bg-gray-50/80 px-6 py-3.5 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5 font-medium">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span>
                      {wordCount} {wordCount === 1 ? "word" : "words"}
                    </span>
                  </div>
                  <span>•</span>
                  <span>{charCount} characters</span>
                  {hasUnsavedChanges && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-800">
                      Unsaved changes
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Copy Button */}
                  <button
                    onClick={handleCopy}
                    disabled={!transcriptText}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-gray-500" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  {/* Export Button */}
                  <button
                    onClick={handleExportTxt}
                    disabled={!transcriptText}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 text-gray-500" />
                    <span>Export .txt</span>
                  </button>

                  {/* Save Button */}
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !hasUnsavedChanges}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition-all inline-flex items-center gap-1.5 ${
                      saveSuccess
                        ? "bg-emerald-600 text-white"
                        : hasUnsavedChanges
                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : saveSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Saved!</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Textarea */}
              <div className="p-6">
                <textarea
                  value={transcriptText}
                  onChange={(e) => setTranscriptText(e.target.value)}
                  placeholder="Transcript text will appear here. You can edit this text directly..."
                  rows={14}
                  className="w-full text-base text-gray-800 leading-relaxed font-sans placeholder:text-gray-400 focus:outline-none resize-y min-h-[16rem]"
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        transcription={transcription}
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}

export default function TranscriptionDetailPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <DetailContent params={params} />
    </Suspense>
  );
}

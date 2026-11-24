"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import Link from "next/link";
import {
  Mic,
  Plus,
  Loader2,
  Inbox,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { TranscriptionCard } from "@/components/dashboard/TranscriptionCard";
import { DeleteConfirmModal } from "@/components/dashboard/DeleteConfirmModal";
import { SearchAndFilter } from "@/components/dashboard/SearchAndFilter";
import { apiClient } from "@/lib/api-client";
import type { Transcription, PaginatedResponse } from "@/types";

export default function DashboardPage() {
  const [data, setData] = useState<PaginatedResponse<Transcription> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("-created_at");
  const [page, setPage] = useState(1);
  const pageSize = 9;

  // Deletion modal state
  const [itemToDelete, setItemToDelete] = useState<Transcription | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on new search
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Load transcriptions
  const loadTranscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.ensureSession();
      const response = await apiClient.getTranscriptions({
        page,
        page_size: pageSize,
        search: debouncedSearch.trim() || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        sort,
      });
      setData(response);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load transcriptions";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, sort]);

  useEffect(() => {
    loadTranscriptions();
  }, [loadTranscriptions]);

  // Delete action
  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await apiClient.deleteTranscription(itemToDelete.id);
      setItemToDelete(null);
      setFeedbackMessage("Transcription deleted successfully.");
      setTimeout(() => setFeedbackMessage(null), 3000);
      loadTranscriptions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete transcription";
      alert(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Export .txt file action
  const handleExportTxt = (tx: Transcription) => {
    const text = tx.transcript_text || "(Empty transcript)";
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeTitle = (tx.title || "transcription").replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
    a.href = url;
    a.download = `${safeTitle}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Transcription History
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              All recordings and drafts created in your current anonymous session.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadTranscriptions}
              disabled={loading}
              className="p-2.5 text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
              title="Refresh"
              aria-label="Refresh history"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Recording</span>
            </Link>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMessage && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium animate-fade-in flex items-center justify-between">
            <span>{feedbackMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <div className="flex-1">{error}</div>
            <button
              onClick={loadTranscriptions}
              className="px-3 py-1 bg-white border border-rose-300 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50"
            >
              Retry
            </button>
          </div>
        )}

        {/* Search, Status Tabs, and Sort */}
        <SearchAndFilter
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={(val) => {
            setStatusFilter(val);
            setPage(1);
          }}
          sort={sort}
          onSortChange={(val) => {
            setSort(val);
            setPage(1);
          }}
        />

        {/* Content Section */}
        {loading && !data ? (
          /* Loading Skeletons */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 p-5 h-56 animate-pulse flex flex-col justify-between"
              >
                <div>
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                  <div className="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
                  <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                </div>
                <div className="h-6 bg-gray-100 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : data && data.items.length > 0 ? (
          <>
            {/* Grid of Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.items.map((tx) => (
                <TranscriptionCard
                  key={tx.id}
                  transcription={tx}
                  onDelete={(item) => setItemToDelete(item)}
                  onExportTxt={handleExportTxt}
                />
              ))}
            </div>

            {/* Pagination Bar */}
            {data.pages > 1 && (
              <div className="mt-8 pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs text-gray-500">
                  Showing{" "}
                  <span className="font-semibold text-gray-800">
                    {(page - 1) * pageSize + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-gray-800">
                    {Math.min(page * pageSize, data.total)}
                  </span>{" "}
                  of <span className="font-semibold text-gray-800">{data.total}</span>{" "}
                  recordings
                </p>

                <div className="inline-flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={page <= 1 || loading}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shadow-sm"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>

                  <span className="text-xs font-medium text-gray-600 px-2">
                    Page {page} of {data.pages}
                  </span>

                  <button
                    onClick={() => setPage((p) => Math.min(p + 1, data.pages))}
                    disabled={page >= data.pages || loading}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shadow-sm"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Empty State */
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center max-w-lg mx-auto my-12">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <Inbox className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {debouncedSearch || statusFilter !== "all"
                ? "No matching recordings found"
                : "No recordings yet"}
            </h3>
            <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
              {debouncedSearch || statusFilter !== "all"
                ? "Try clearing your search term or selecting a different status filter."
                : "Record speech in real-time with Google Gemini AI. SpeechFlow automatically transcribes and saves your session."}
            </p>

            {debouncedSearch || statusFilter !== "all" ? (
              <button
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                }}
                className="px-4 py-2 text-sm font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
              >
                Reset Filters
              </button>
            ) : (
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all"
              >
                <Mic className="w-4 h-4" />
                <span>Start First Recording</span>
              </Link>
            )}
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(itemToDelete)}
        transcription={itemToDelete}
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
}

"use client";

import { useAnonymousSession } from "@/hooks/useAnonymousSession";
import { useRecording } from "@/hooks/useRecording";
import { Header } from "@/components/layout/Header";
import { RecordingControls } from "@/components/recording/RecordingControls";
import { RecordingTimer } from "@/components/recording/RecordingTimer";
import { RecordingStatusBadge } from "@/components/recording/RecordingStatusBadge";
import { LanguageSelector } from "@/components/recording/LanguageSelector";
import { TranscriptDisplay } from "@/components/transcription/TranscriptDisplay";
import { TranscriptActions } from "@/components/transcription/TranscriptActions";
import { TitleEditor } from "@/components/transcription/TitleEditor";
import { AudioPlayer } from "@/components/common/AudioPlayer";
import { AlertTriangle, Sparkles, ShieldCheck } from "lucide-react";

export default function RecordingPage() {
  const { sessionId, isLoading: isSessionLoading } = useAnonymousSession();
  const {
    recordingState,
    title,
    setTitle,
    interimText,
    finalText,
    durationSeconds,
    languageMode,
    setLanguageMode,
    transcriptionMode,
    setTranscriptionMode,
    saveState,
    errorMessage,
    audioUrl,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    clearTranscript,
    manualSave,
  } = useRecording();

  const isRecording = recordingState === "recording";
  const isBusy = isRecording || recordingState === "paused" || recordingState === "connecting";

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-50">
      {/* Global Navigation Header */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3 shadow-sm animate-in fade-in duration-200">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-red-800">
              <strong className="font-semibold block">Recording Error</strong>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Main Recording Workspace Card */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 flex flex-col gap-6">
          {/* Top Header: Title, Timer, Status */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
            <TitleEditor
              title={title}
              onSaveTitle={(newTitle) => {
                setTitle(newTitle);
                manualSave(newTitle);
              }}
              disabled={isBusy}
            />

            <div className="flex items-center gap-3">
              <RecordingTimer durationSeconds={durationSeconds} isRecording={isRecording} />
              <RecordingStatusBadge status={recordingState} />
            </div>
          </div>

          {/* Configuration Toolbar: Language & Smart Toggle */}
          <LanguageSelector
            languageMode={languageMode}
            onLanguageChange={setLanguageMode}
            transcriptionMode={transcriptionMode}
            onTranscriptionModeChange={setTranscriptionMode}
            disabled={isBusy}
          />

          {/* Central Live Transcript Container */}
          <TranscriptDisplay
            finalText={finalText}
            interimText={interimText}
            recordingState={recordingState}
          />

          {/* Audio Playback Player (visible once audio recording is available) */}
          {audioUrl && (
            <div className="animate-in fade-in duration-300">
              <AudioPlayer audioUrl={audioUrl} title={title} />
            </div>
          )}

          {/* Bottom Actions: Copy, Save, Clear, Export */}
          <TranscriptActions
            transcriptText={finalText}
            title={title}
            saveState={saveState}
            onSave={() => manualSave()}
            onClear={clearTranscript}
            isRecording={isRecording}
            audioUrl={audioUrl}
          />

          {/* Primary Big Recording Control Buttons */}
          <div className="pt-2">
            <RecordingControls
              recordingState={recordingState}
              onStart={startRecording}
              onPause={pauseRecording}
              onResume={resumeRecording}
              onStop={stopRecording}
            />
          </div>
        </section>

        {/* Information & Privacy Footer Card */}
        <footer className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-xs text-gray-500 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>
              Anonymous session active. Your transcripts are saved securely to Supabase PostgreSQL without requiring an account.
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-gray-600">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Powered by Gemini Live API</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

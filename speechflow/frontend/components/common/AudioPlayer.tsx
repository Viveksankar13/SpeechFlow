"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Download, Disc, Music } from "lucide-react";

interface AudioPlayerProps {
  audioUrl: string | null;
  title?: string;
  className?: string;
}

export function AudioPlayer({ audioUrl, title = "Recording", className = "" }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Reset state when audioUrl changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [audioUrl]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [isPlaying, audioUrl]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const d = audioRef.current.duration;
      if (Number.isFinite(d) && !isNaN(d)) {
        setDuration(d);
      }
    }
  };

  const handleDurationChange = () => {
    if (audioRef.current) {
      const d = audioRef.current.duration;
      if (Number.isFinite(d) && !isNaN(d)) {
        setDuration(d);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleRestart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const cycleSpeed = () => {
    const rates = [1, 1.25, 1.5, 2];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const handleDownloadAudio = () => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    const safeTitle = (title || "recording").replace(/[^a-zA-Z0-9_-]/g, "_");
    a.download = `${safeTitle}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || isNaN(secs)) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (!audioUrl) return null;

  return (
    <div
      className={`rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-purple-50/80 border border-blue-200/80 p-4 shadow-sm flex flex-col gap-3 ${className}`}
    >
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={handleDurationChange}
        onEnded={handleEnded}
      />

      <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
        {/* Play / Pause & Restart */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            title={isPlaying ? "Pause audio" : "Play recording"}
            className="w-11 h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md shadow-blue-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer flex-shrink-0"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-white" />
            ) : (
              <Play className="w-5 h-5 fill-white ml-0.5" />
            )}
          </button>

          <button
            onClick={handleRestart}
            title="Restart from beginning"
            className="w-8 h-8 rounded-full text-gray-500 hover:text-gray-800 hover:bg-white/70 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Title, Scrubber & Timing */}
        <div className="flex-1 flex flex-col min-w-[200px] w-full sm:w-auto">
          <div className="flex items-center justify-between text-xs font-medium text-gray-600 mb-1">
            <span className="truncate flex items-center gap-1.5 font-semibold text-gray-800">
              <Disc className={`w-3.5 h-3.5 text-blue-600 ${isPlaying ? "animate-spin" : ""}`} />
              <span>Voice Playback</span>
              <span className="text-gray-400 font-normal hidden md:inline truncate">({title})</span>
            </span>
            <span className="font-mono text-xs tabular-nums text-gray-700 font-medium">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Timeline progress range */}
          <div className="relative flex items-center">
            <input
              type="range"
              min={0}
              max={duration > 0 ? duration : 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-gray-200/90 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Speed, Mute & Download controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto sm:ml-0">
          <button
            onClick={cycleSpeed}
            title="Playback speed"
            className="px-2 py-1 text-xs font-semibold rounded-md bg-white/80 hover:bg-white text-gray-700 border border-gray-200 shadow-2xs transition-colors cursor-pointer"
          >
            {playbackRate}x
          </button>

          <button
            onClick={toggleMute}
            title={isMuted ? "Unmute" : "Mute"}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-white/70 transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            onClick={handleDownloadAudio}
            title="Download audio recording (.webm)"
            className="px-2.5 py-1.5 rounded-lg text-blue-700 bg-white/80 hover:bg-white border border-blue-200 transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download Audio</span>
          </button>
        </div>
      </div>
    </div>
  );
}

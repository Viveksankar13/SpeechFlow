"use client";

interface RecordingTimerProps {
  durationSeconds: number;
  isRecording: boolean;
}

export function RecordingTimer({ durationSeconds, isRecording }: RecordingTimerProps) {
  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);
  const seconds = durationSeconds % 60;

  const formattedTime =
    hours > 0
      ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-gray-100/80 border border-gray-200">
      {isRecording && (
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
        </span>
      )}
      <span className="font-mono text-sm font-semibold text-gray-700 tracking-wider">
        {formattedTime}
      </span>
    </div>
  );
}

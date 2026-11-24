"use client";

import { useRef, useCallback } from "react";

const PCM_WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sourceSampleRate = sampleRate;
    this.targetSampleRate = 16000;
    this.sampleRatio = this.sourceSampleRate / this.targetSampleRate;
    this.chunkSize = 1600;
    this.buffer = new Int16Array(this.chunkSize);
    this.bufferIndex = 0;
    this.resamplePhase = 0.0;
    this.prevSample = 0.0;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channelCount = input.length;
    const channel0 = input[0];
    if (!channel0 || channel0.length === 0) return true;
    const inputLength = channel0.length;
    for (let i = 0; i < inputLength; i++) {
      let currentSample = channel0[i];
      if (channelCount > 1) {
        for (let c = 1; c < channelCount; c++) {
          currentSample += input[c][i];
        }
        currentSample /= channelCount;
      }
      while (this.resamplePhase < 1.0) {
        const interpolated = this.prevSample + this.resamplePhase * (currentSample - this.prevSample);
        const clamped = Math.max(-1.0, Math.min(1.0, interpolated));
        const pcm16 = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
        this.buffer[this.bufferIndex++] = pcm16;
        if (this.bufferIndex >= this.chunkSize) {
          const outBuffer = this.buffer.buffer.slice(0);
          this.port.postMessage(outBuffer, [outBuffer]);
          this.bufferIndex = 0;
        }
        this.resamplePhase += this.sampleRatio;
      }
      this.resamplePhase -= 1.0;
      this.prevSample = currentSample;
    }
    return true;
  }
}
registerProcessor("pcm-processor", PCMProcessor);
`;

export function useAudioStream() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const startAudioProcessing = useCallback(
    async (
      stream: MediaStream,
      onAudioChunk: (chunk: ArrayBuffer) => void
    ): Promise<void> => {
      // Create new AudioContext
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioCtx();
      audioContextRef.current = audioContext;

      // Resume context if suspended (browser autoplay policy)
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      // Load AudioWorklet module (first try /pcm-processor.js, then fallback to inline blob)
      try {
        await audioContext.audioWorklet.addModule("/pcm-processor.js");
      } catch {
        try {
          const blob = new Blob([PCM_WORKLET_CODE], { type: "application/javascript" });
          const blobUrl = URL.createObjectURL(blob);
          await audioContext.audioWorklet.addModule(blobUrl);
          URL.revokeObjectURL(blobUrl);
        } catch (workletErr) {
          throw new Error(
            "Failed to initialize AudioWorklet processor: " +
              (workletErr instanceof Error ? workletErr.message : String(workletErr))
          );
        }
      }

      // Create audio nodes
      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, "pcm-processor");

      // Handle raw PCM binary chunks emitted from the worklet thread
      workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (event.data && event.data.byteLength > 0) {
          onAudioChunk(event.data);
        }
      };

      // Connect source to worklet. Do NOT connect worklet to audioContext.destination (avoids audio feedback!)
      source.connect(workletNode);

      sourceNodeRef.current = source;
      workletNodeRef.current = workletNode;
    },
    []
  );

  const stopAudioProcessing = useCallback(async () => {
    if (workletNodeRef.current) {
      workletNodeRef.current.port.onmessage = null;
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        await audioContextRef.current.close();
      } catch {
        // Ignore close errors
      }
      audioContextRef.current = null;
    }
  }, []);

  return {
    startAudioProcessing,
    stopAudioProcessing,
  };
}

/**
 * SpeechFlow AudioWorklet Processor: pcm-processor.js
 * 
 * Runs on a dedicated audio rendering thread off the main UI thread.
 * Responsibilities:
 * 1. Captures raw floating-point microphone samples.
 * 2. Downsamples from native hardware sample rate (e.g. 44.1kHz or 48kHz) to 16,000 Hz
 *    using linear interpolation for clear speech intelligibility without aliasing.
 * 3. Converts 32-bit floats [-1.0, 1.0] to signed 16-bit Little-Endian PCM integers [-32768, 32767].
 * 4. Buffers samples into ~100ms chunks (1,600 samples = 3,200 bytes) as required by Gemini Live API.
 * 5. Transfers ArrayBuffers directly to the main thread with zero memory copying.
 */

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Hardware sample rate provided by Web Audio AudioContext (typically 44100 or 48000)
    this.sourceSampleRate = sampleRate;
    this.targetSampleRate = 16000;
    this.sampleRatio = this.sourceSampleRate / this.targetSampleRate;

    // Buffer to accumulate resampled 16-bit PCM samples
    // 100ms at 16kHz = 1,600 samples
    this.chunkSize = 1600;
    this.buffer = new Int16Array(this.chunkSize);
    this.bufferIndex = 0;

    // Resampling interpolation state
    this.resamplePhase = 0.0;
    this.prevSample = 0.0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }

    // Use mono channel (channel 0) or average if stereo
    const channelCount = input.length;
    const channel0 = input[0];
    if (!channel0 || channel0.length === 0) {
      return true;
    }

    const inputLength = channel0.length;

    // Process each incoming sample with linear interpolation resampling
    for (let i = 0; i < inputLength; i++) {
      let currentSample = channel0[i];
      if (channelCount > 1) {
        // Average stereo channels
        for (let c = 1; c < channelCount; c++) {
          currentSample += input[c][i];
        }
        currentSample /= channelCount;
      }

      while (this.resamplePhase < 1.0) {
        // Linear interpolation between previous sample and current sample
        const interpolated = this.prevSample + this.resamplePhase * (currentSample - this.prevSample);

        // Clamp float to [-1.0, 1.0]
        const clamped = Math.max(-1.0, Math.min(1.0, interpolated));

        // Scale to 16-bit signed PCM integer
        const pcm16 = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);

        this.buffer[this.bufferIndex++] = pcm16;

        // When we have accumulated a 100ms chunk (1600 samples), emit to main thread
        if (this.bufferIndex >= this.chunkSize) {
          // Transfer buffer ownership for zero-copy performance
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

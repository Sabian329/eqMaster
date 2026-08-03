import type { ChannelMode } from '../types';

export function makeSweep(
  sampleRate: number,
  startFrequency: number,
  endFrequency: number,
  durationSeconds: number,
  levelDb: number,
): Float32Array {
  const length = Math.round(sampleRate * durationSeconds);
  const data = new Float32Array(length);
  const amplitude = Math.pow(10, levelDb / 20);
  const logRatio = Math.log(endFrequency / startFrequency);
  const phaseScale = (2 * Math.PI * startFrequency * durationSeconds) / logRatio;
  const fadeSamples = Math.max(1, Math.round(sampleRate * 0.05));

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const phase = phaseScale * (Math.exp((t / durationSeconds) * logRatio) - 1);

    let envelope = 1;
    if (i < fadeSamples) {
      envelope = 0.5 - 0.5 * Math.cos((Math.PI * i) / fadeSamples);
    } else if (i >= length - fadeSamples) {
      const remaining = length - 1 - i;
      envelope = 0.5 - 0.5 * Math.cos((Math.PI * remaining) / fadeSamples);
    }

    data[i] = Math.sin(phase) * amplitude * envelope;
  }

  return data;
}

export function makeSweepBuffer(
  context: AudioContext,
  sweepData: Float32Array,
  channelMode: ChannelMode,
): AudioBuffer {
  const buffer = context.createBuffer(2, sweepData.length, context.sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  if (channelMode === 'left' || channelMode === 'both') left.set(sweepData);
  if (channelMode === 'right' || channelMode === 'both') right.set(sweepData);

  return buffer;
}

export function createAudioContext(): AudioContext {
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new AudioCtx({ latencyHint: 'interactive', sampleRate: 48000 });
}

export async function setOutputDevice(
  context: AudioContext,
  deviceId: string,
): Promise<void> {
  if (deviceId && typeof context.setSinkId === 'function') {
    try {
      await context.setSinkId(deviceId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Could not set audio output: ${message}. Set your interface as the system default output.`,
      );
    }
  }
}

export function createAudioConstraints(deviceId: string): MediaStreamConstraints {
  const audio: MediaTrackConstraints = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: { ideal: 1 },
    sampleRate: { ideal: 48000 },
  };

  if (deviceId) {
    audio.deviceId = { exact: deviceId };
  }

  return { audio };
}

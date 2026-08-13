import type { ChannelMode } from '../types';

export function makePinkNoise(
  sampleRate: number,
  durationSeconds: number,
  levelDb: number,
): Float32Array {
  const length = Math.round(sampleRate * durationSeconds);
  const data = new Float32Array(length);
  const amplitude = Math.pow(10, levelDb / 20);
  const fadeSamples = Math.max(1, Math.round(sampleRate * 0.03));

  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;

  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;

    let envelope = 1;
    if (i < fadeSamples) {
      envelope = 0.5 - 0.5 * Math.cos((Math.PI * i) / fadeSamples);
    } else if (i >= length - fadeSamples) {
      envelope = 0.5 - 0.5 * Math.cos((Math.PI * (length - 1 - i)) / fadeSamples);
    }

    data[i] = pink * 0.11 * amplitude * envelope;
  }

  return data;
}

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

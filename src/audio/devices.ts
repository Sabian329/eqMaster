import type { SelectedOutputDevice } from '../types';

export function isAliasDeviceId(deviceId: string): boolean {
  return !deviceId || deviceId === 'default' || deviceId === 'communications';
}

export function deduplicateDevices(devices: MediaDeviceInfo[]): MediaDeviceInfo[] {
  const seen = new Set<string>();
  const result: MediaDeviceInfo[] = [];

  for (const device of devices) {
    const key = `${device.kind}:${device.deviceId || 'default'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(device);
  }

  return result;
}

export interface DeviceListResult {
  inputs: MediaDeviceInfo[];
  outputs: MediaDeviceInfo[];
  unnamedInputs: number;
  unnamedOutputs: number;
}

export async function enumerateAudioDevices(): Promise<DeviceListResult> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return { inputs: [], outputs: [], unnamedInputs: 0, unnamedOutputs: 0 };
  }

  const devices = deduplicateDevices(await navigator.mediaDevices.enumerateDevices());
  const rawInputs = devices.filter((d) => d.kind === 'audioinput');
  const rawOutputs = devices.filter((d) => d.kind === 'audiooutput');

  const inputs = rawInputs.filter((d) => !isAliasDeviceId(d.deviceId));
  const outputs = rawOutputs.filter((d) => !isAliasDeviceId(d.deviceId));

  return {
    inputs,
    outputs,
    unnamedInputs: inputs.filter((d) => !d.label).length,
    unnamedOutputs: outputs.filter((d) => !d.label).length,
  };
}

export async function requestMicrophonePermission(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Przeglądarka nie udostępnia mikrofonu.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: { ideal: 1 },
    },
  });

  try {
    await enumerateAudioDevices();
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}

export async function chooseOutputDevice(
  currentDeviceId?: string,
): Promise<SelectedOutputDevice> {
  if (typeof navigator.mediaDevices?.selectAudioOutput !== 'function') {
    throw new Error(
      'Ta przeglądarka nie udostępnia selektora wyjścia. Ustaw interfejs jako domyślne wyjście w ustawieniach dźwięku macOS.',
    );
  }

  const options = currentDeviceId ? { deviceId: currentDeviceId } : undefined;
  const selected = await navigator.mediaDevices.selectAudioOutput(options);

  return {
    deviceId: selected.deviceId,
    kind: selected.kind || 'audiooutput',
    label: selected.label || 'Wybrane wyjście audio',
  };
}

export interface EnvironmentInfo {
  hasMedia: boolean;
  secure: boolean;
  hasAudio: boolean;
  hasWorklet: boolean;
  supportsSink: boolean;
  supportsOutputPicker: boolean;
  ready: boolean;
}

export function checkEnvironment(): EnvironmentInfo {
  const hasMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const secure = window.isSecureContext;
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const hasAudio = !!AudioCtx;
  const hasWorklet = hasAudio && 'AudioWorkletNode' in window;
  const supportsSink = hasAudio && 'setSinkId' in AudioContext.prototype;
  const supportsOutputPicker =
    typeof navigator.mediaDevices?.selectAudioOutput === 'function';

  return {
    hasMedia,
    secure,
    hasAudio,
    hasWorklet,
    supportsSink,
    supportsOutputPicker,
    ready: hasMedia && secure && hasAudio,
  };
}

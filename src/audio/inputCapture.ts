const HIGH_CHANNEL_REQUEST = 32;

type VoiceIsolationConstraints = MediaTrackConstraints & {
  voiceIsolation?: boolean | ConstrainBoolean;
};

export function isUadApolloLabel(label: string): boolean {
  const normalized = label.toLowerCase();
  return (
    normalized.includes('universal audio') ||
    normalized.includes('apollo') ||
    /\buad\b/.test(normalized)
  );
}

export function clampInputChannelIndex(
  channelIndex: number,
  channelCount: number,
): number {
  const maxIndex = Math.max(0, channelCount - 1);
  if (!Number.isFinite(channelIndex)) return 0;
  return Math.min(maxIndex, Math.max(0, Math.round(channelIndex)));
}

export function formatInputChannelOption(channelIndex: number): string {
  return `Capture channel ${channelIndex + 1}`;
}

export function uadInputRoutingHint(label: string): string | null {
  if (!isUadApolloLabel(label)) return null;
  return (
    'UAD Apollo appears as one CoreAudio device. Chromium can open that device and the channels it actually delivers — it cannot see Console names such as Mic 1 vs Virtual 1. ' +
    'Use Monitor input (no playback), tap the microphone, and choose the Capture channel that moves. ' +
    'If the meter follows speakers and not the mic, Console I/O Matrix or Virtual/LOOPBACK is on that stream. ' +
    'The app cannot change Console routing. Workaround: an Aggregate Device in Audio MIDI Setup with only the analog mic inputs.'
  );
}

function trackSupportsConstraint(
  track: MediaStreamTrack,
  name: string,
): boolean {
  try {
    const capabilities = track.getCapabilities?.() as
      | Record<string, unknown>
      | undefined;
    return Boolean(capabilities && name in capabilities);
  } catch {
    return false;
  }
}

export function createRawAudioConstraints(
  deviceId: string,
  options?: {
    channelCountIdeal?: number;
    includeVoiceIsolation?: boolean;
  },
): MediaStreamConstraints {
  const audio: VoiceIsolationConstraints = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    sampleRate: { ideal: 48000 },
  };

  if (options?.includeVoiceIsolation !== false) {
    audio.voiceIsolation = false;
  }

  // Never request a 1-channel capture. Chrome downmixes every hardware input
  // (Apollo Virtual/LOOPBACK included) into that track.
  if (options?.channelCountIdeal && options.channelCountIdeal > 1) {
    audio.channelCount = { ideal: options.channelCountIdeal };
  }

  if (deviceId) {
    audio.deviceId = { exact: deviceId };
  }

  return { audio };
}

export async function applyRawProcessingConstraints(
  track: MediaStreamTrack,
): Promise<void> {
  const constraints: VoiceIsolationConstraints = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  };

  if (trackSupportsConstraint(track, 'voiceIsolation')) {
    constraints.voiceIsolation = false;
  }

  try {
    await track.applyConstraints(constraints);
  } catch {
    // Keep the stream if the browser rejects a processing flag.
  }
}

export function logInputTrackDiagnostics(
  track: MediaStreamTrack,
  source: string,
): void {
  if (!import.meta.env.DEV) return;

  const settings = track.getSettings?.() ?? {};
  const constraints = track.getConstraints?.() ?? {};
  let capabilities: MediaTrackCapabilities | Record<string, never> = {};
  try {
    capabilities = track.getCapabilities?.() ?? {};
  } catch {
    capabilities = {};
  }

  console.log(`[Audio Input] ${source} settings`, {
    deviceId: settings.deviceId,
    groupId: settings.groupId,
    channelCount: settings.channelCount,
    sampleRate: settings.sampleRate,
    sampleSize: settings.sampleSize,
    echoCancellation: settings.echoCancellation,
    noiseSuppression: settings.noiseSuppression,
    autoGainControl: settings.autoGainControl,
  });
  console.log(`[Audio Input] ${source} constraints`, constraints);
  console.log(`[Audio Input] ${source} capabilities`, capabilities);
}

function trackChannelCount(track: MediaStreamTrack): number {
  const settings = track.getSettings?.() ?? {};
  const fromSettings = settings.channelCount ?? 0;
  let fromCapabilities = 0;
  try {
    fromCapabilities = track.getCapabilities?.().channelCount?.max ?? 0;
  } catch {
    fromCapabilities = 0;
  }
  return Math.max(1, fromSettings, fromCapabilities);
}

async function getUserMediaWithFallback(
  deviceId: string,
  channelCountIdeal?: number,
): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia(
      createRawAudioConstraints(deviceId, { channelCountIdeal }),
    );
  } catch {
    return navigator.mediaDevices.getUserMedia(
      createRawAudioConstraints(deviceId, {
        channelCountIdeal,
        includeVoiceIsolation: false,
      }),
    );
  }
}

export interface OpenedMeasurementInput {
  stream: MediaStream;
  channelCount: number;
  settings: MediaTrackSettings;
}

export async function openMeasurementInput(
  deviceId: string,
): Promise<OpenedMeasurementInput> {
  const open = async (channelCountIdeal?: number) => {
    const stream = await getUserMediaWithFallback(deviceId, channelCountIdeal);
    const track = stream.getAudioTracks()[0];
    if (!track) {
      stream.getTracks().forEach((item) => item.stop());
      throw new Error('The selected input did not provide an audio track.');
    }
    await applyRawProcessingConstraints(track);
    return {
      stream,
      track,
      channelCount: trackChannelCount(track),
    };
  };

  let opened = await open();

  // Chrome often downmixes every Apollo input (including Virtual/LOOPBACK)
  // into 1–2 tracks. Close the exclusive device, then ask for discrete channels.
  if (opened.channelCount <= 2) {
    opened.stream.getTracks().forEach((item) => item.stop());
    try {
      opened = await open(HIGH_CHANNEL_REQUEST);
    } catch {
      opened = await open();
    }
  }

  logInputTrackDiagnostics(opened.track, 'openMeasurementInput');

  return {
    stream: opened.stream,
    channelCount: Math.max(1, opened.channelCount),
    settings: opened.track.getSettings?.() ?? {},
  };
}

export function connectInputChannel(
  source: AudioNode,
  destination: AudioNode,
  channelIndex: number,
  sourceChannelCount: number,
): AudioNode {
  const index = clampInputChannelIndex(channelIndex, sourceChannelCount);

  try {
    source.channelInterpretation = 'discrete';
  } catch {
    // Some nodes ignore this; ChannelSplitter still isolates the channel.
  }

  if (sourceChannelCount <= 1 && index === 0) {
    source.connect(destination);
    return source;
  }

  const outputs = Math.min(32, Math.max(sourceChannelCount, index + 1, 2));
  const splitter = source.context.createChannelSplitter(outputs);
  source.connect(splitter);
  splitter.connect(destination, index, 0);
  return splitter;
}

export function createRecorderTap(context: AudioContext): AudioNode {
  return context.createMediaStreamDestination();
}

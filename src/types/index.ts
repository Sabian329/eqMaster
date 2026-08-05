export type MeasurementCount = 1 | 2 | 3;

export type SetupMode = 'live' | 'test';

export type MeasurementSessionStep =
  | 'mic-test'
  | 'ready'
  | 'measuring'
  | 'run-complete';

export interface MeasurementRun {
  index: number;
  label: string;
  curve: CurvePoint[];
  suggestions: Suggestion[];
  meta: MeasurementMeta;
}

export interface ChartSeries {
  id: string;
  label: string;
  curve: CurvePoint[];
  color: string;
  lineWidth: number;
  alpha?: number;
  dash?: number[];
}

export type DeviceStatusType = '' | 'good' | 'warning' | 'bad';

export type ChannelMode = 'left' | 'right' | 'both';

export type SuggestionKind = 'cut' | 'boost' | 'null';

export interface CurvePoint {
  frequency: number;
  db: number;
}

export type SuggestionSource = 'auto' | 'custom';

export interface Suggestion {
  kind: SuggestionKind;
  frequency: number;
  deviation: number;
  gain: number | null;
  q: number;
  note: string;
  enabled?: boolean;
  source?: SuggestionSource;
  customId?: string;
}

export interface MeasurementMeta {
  date: string;
  sampleRate: number;
  samples: number;
  peakDb: number;
  noiseDb: number;
  fMin: number;
  fMax: number;
  durationSeconds: number;
  smoothing: number;
  levelDb: number;
  channel: ChannelMode;
  inputLabel: string;
  outputLabel: string;
  trackSettings: MediaTrackSettings;
  fftSize: number;
  calibrationPoints: number;
  recorderMode: string;
}

export interface ChartBounds {
  padding: { left: number; right: number; top: number; bottom: number };
  width: number;
  height: number;
  plotWidth: number;
  plotHeight: number;
  fMin: number;
  fMax: number;
  yMin: number;
  yMax: number;
  xForFrequency: (frequency: number) => number;
  yForDb: (db: number) => number;
}

export interface MeasurementConfig {
  inputDeviceId: string;
  outputDeviceId: string;
  channel: ChannelMode;
  fStart: number;
  fEnd: number;
  duration: number;
  smoothing: number;
  level: number;
}

export interface AnalysisResult {
  curve: CurvePoint[];
  suggestions: Suggestion[];
  fftSize: number;
  normalization: number;
}

export interface RecorderChunk {
  frame: number;
  data: Float32Array;
}

export interface LevelTestSession {
  stream: MediaStream;
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  silent: GainNode;
  rafId: number;
}

export interface SelectedOutputDevice {
  deviceId: string;
  kind: string;
  label: string;
}

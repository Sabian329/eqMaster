export type MeasurementCount = 1 | 2 | 3;

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

/** Persisted measurement library entry (web + Electron via localStorage). */
export interface SavedMeasurement {
  id: string;
  /** e.g. "Studio · #3 · 40 Hz – 20 kHz · 2026-08-06 15:38" */
  name: string;
  /** Name prefix chosen at save time, e.g. "Studio". */
  prefix?: string;
  /** Monotonic library number shown in names / presets. */
  measurementNumber?: number;
  savedAt: string;
  meta: MeasurementMeta;
  curve: CurvePoint[];
  runs: MeasurementRun[];
  average: MeasurementRun | null;
}

/** Persisted EQ preset library entry (web + Electron via localStorage). */
export interface SavedPreset {
  id: string;
  name: string;
  savedAt: string;
  preamp: number;
  text: string;
  suggestions: Suggestion[];
  eqAlgorithmVersion?: string;
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

export type EqFilterType = 'PK' | 'LS' | 'HS';

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
  filterType?: EqFilterType;
  safetyAdjusted?: boolean;
  localImprovement?: number;
  offBandDamage?: number;
  confidence?: number;
  improvementPercent?: number;
  reason?: string;
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
  inputChannel?: number;
  inputChannelCount?: number;
  loopbackWarning?: string;
  trackSettings: MediaTrackSettings;
  fftSize: number;
  calibrationPoints: number;
  recorderMode: string;
  verificationMode?: boolean;
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

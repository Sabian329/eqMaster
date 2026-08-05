export interface FrequencyPoint {
  frequency: number;
  db: number;
}

export interface Measurement {
  id: string;
  points: FrequencyPoint[];
  sampleRate: number;
  impulseResponse?: Float32Array;
}

export type EqFilterType = 'PK' | 'LS' | 'HS';

export type FilterReason =
  | 'modal-resonance'
  | 'repeated-peak'
  | 'broad-tonal-error'
  | 'low-frequency-tilt'
  | 'high-frequency-tilt';

export interface GeneratedEqFilter {
  id: string;
  type: EqFilterType;
  frequency: number;
  gainDb: number;
  q: number;
  enabled: boolean;
  confidence: number;
  improvementPercent: number;
  affectedRange: { fromHz: number; toHz: number };
  reason: FilterReason;
}

export type TargetType = 'flat' | 'room' | 'custom';

export type AutoEqPrecision = 'standard' | 'high';

export type AutoEqWarning =
  | 'single-measurement-high-frequency-correction'
  | 'low-repeatability'
  | 'attempted-boost-outside-usable-range'
  | 'excessive-required-headroom'
  | 'measurement-near-noise-floor'
  | 'insufficient-frequency-resolution'
  | 'deep-null-detected'
  | 'correction-limited-by-speaker-range'
  | 'optimizer-stopped-early';

export interface AutoEqOptions {
  targetType: TargetType;
  customTarget?: FrequencyPoint[];
  maxFilters: number;
  allowBoosts: boolean;
  fullRangeCorrection: boolean;
  minFrequency: number;
  maxFrequency: number;
  sampleRate: number;
  seed: number;
  precision: AutoEqPrecision;
}

export interface AutoEqProgress {
  stage:
    | 'preparing'
    | 'analyzing'
    | 'generating-candidates'
    | 'selecting-filters'
    | 'optimizing'
    | 'post-processing'
    | 'finalizing';
  progress: number;
  currentCost?: number;
  filterCount?: number;
}

export interface AutoEqResultV2 {
  filters: GeneratedEqFilter[];
  preampDb: number;
  measured: FrequencyPoint[];
  broadMeasured: FrequencyPoint[];
  target: FrequencyPoint[];
  predicted: FrequencyPoint[];
  combinedFilterResponse: FrequencyPoint[];
  errorBefore: number;
  errorAfter: number;
  rmsErrorBeforeDb: number;
  rmsErrorAfterDb: number;
  maximumErrorBeforeDb: number;
  maximumErrorAfterDb: number;
  confidence: number;
  warnings: AutoEqWarning[];
}

export interface PreparedMeasurementGrid {
  detailed: FrequencyPoint[];
  broad: FrequencyPoint[];
  target: FrequencyPoint[];
  narrowResidual: FrequencyPoint[];
  tonalError: FrequencyPoint[];
  reliability: Float64Array;
  repeatabilityDb: Float64Array;
  measurementCount: number;
  usableRange: { fromHz: number; toHz: number };
  warnings: AutoEqWarning[];
}

export interface ResonanceCandidate {
  frequency: number;
  prominenceDb: number;
  bandwidthOctaves: number;
  q: number;
  score: number;
  reason: FilterReason;
  reliability: number;
  isNull: boolean;
}

export interface FilterCandidate {
  type: EqFilterType;
  frequency: number;
  gainDb: number;
  q: number;
  reason: FilterReason;
  confidence: number;
}

export interface OptimizationContext {
  prepared: PreparedMeasurementGrid;
  measurements: FrequencyPoint[][];
  options: AutoEqOptions;
  denseGrid: FrequencyPoint[];
}

import type { AutoEqV3Options, FrequencyPoint } from './types';

export const ROOM_TARGET: FrequencyPoint[] = [
  { frequency: 20, db: 3.0 },
  { frequency: 40, db: 3.0 },
  { frequency: 100, db: 2.0 },
  { frequency: 300, db: 1.0 },
  { frequency: 1_000, db: 0.0 },
  { frequency: 5_000, db: -0.5 },
  { frequency: 10_000, db: -1.0 },
  { frequency: 20_000, db: -2.0 },
];

export const DEFAULT_V3_OPTIONS: AutoEqV3Options = {
  targetType: 'room',
  maxFilters: 16,
  allowBoosts: true,
  fullRangeCorrection: true,
  minFrequency: 20,
  maxFrequency: 20_000,
  sampleRate: 48_000,
  seed: 42,
};

export const V3_CANDIDATE_BUDGET = {
  resonance: 32,
  tonal: 16,
  shelf: 8,
} as const;

export const CANDIDATES_PER_ITERATION = {
  resonance: 12,
  tonal: 8,
  shelf: 4,
} as const;

export const DETAILED_SMOOTHING_FRACTION = 12;
export const BROAD_SMOOTHING_FRACTION = 3;
export const DETAILED = 1 / 12;
export const BROAD = 1 / 3;

export const MIN_PROMINENCE_DB = 1.25;
export const MIN_RELIABILITY = 0.45;
export const NULL_DEPTH_DB = 7;
export const NULL_MAX_BANDWIDTH_OCT = 0.35;
export const USABLE_RANGE_DROP_DB = 8;
export const BELOW_TARGET_BOOST_LIMIT_DB = 10;

export const MIN_TONAL_ERROR_DB = 1.25;
export const MIN_TONAL_WIDTH_OCTAVES = 0.4;

export const MIN_FILTER_GAIN_DB = 0.3;
export const MIN_CONTRIBUTION_PERCENT = 0.15;
export const MIN_IMPROVEMENT_PERCENT = 0.15;

export const HEADROOM_DB = 0.8;
export const PREAMP_WARNING_DB = -8;
export const COST_ERROR_CLAMP_DB = 12;

export const MEASUREMENT_GRID_SIZE = 512;
export const SIM_GRID_SIZE = 512;
export const DENSE_GRID_SIZE = 4096;

export const MEDIAN_WORST_SPLIT = { median: 0.72, worst: 0.28 } as const;
export const BOOST_PENALTY_COEFFICIENT = 1.98;
export const OVERLAP_DISTANCE_OCTAVES = 1 / 12;
export const CANCELLATION_DISTANCE_OCTAVES = 1 / 8;
export const MERGE_CORRELATION_THRESHOLD = 0.95;
export const MERGE_DISTANCE_OCTAVES = 1 / 12;

export const FREQUENCY_OFFSETS_OCTAVES = [-1 / 24, -1 / 48, 0, 1 / 48, 1 / 24] as const;
export const Q_MULTIPLIERS = [0.7, 0.85, 1, 1.2, 1.45] as const;
export const GAIN_MULTIPLIERS = [0.6, 0.75, 0.9, 1] as const;
export const TONAL_Q_VALUES = [0.5, 0.707, 1, 1.4, 2] as const;
/** Wide Q only — HF tonal correction should follow the broad trend, not notches. */
export const HF_TONAL_Q_VALUES = [0.5, 0.707] as const;
export const MID_HF_TONAL_GAIN_DB = { min: -2.5, max: -1.5 } as const;
export const HIGH_HF_TONAL_GAIN_DB = { min: -3.0, max: -2.0 } as const;

export const OPTIMIZATION_STAGES = {
  frequencyStepsOctaves: [1 / 12, 1 / 24, 1 / 48, 1 / 96] as const,
  gainStepsDb: [1, 0.5, 0.25, 0.1] as const,
  qMultipliersPerStage: [1.5, 1.25, 1.1, 1.04] as const,
} as const;

export const MAX_OPTIMIZER_PASSES = 12;
export const MULTI_START_VARIANTS = 3;
export const REGENERATION_CYCLES = 1;
export const GAIN_RETUNE_DELTAS_DB = [0.5, 0.25, -0.25, -0.5] as const;
export const GAIN_RETUNE_PASSES = 3;

export const HUBER_DELTA = 2;

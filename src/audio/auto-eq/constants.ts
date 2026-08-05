import type { AutoEqOptions, FrequencyPoint } from './types';

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

export const DEFAULT_AUTO_EQ_OPTIONS: AutoEqOptions = {
  targetType: 'room',
  maxFilters: 16,
  allowBoosts: true,
  fullRangeCorrection: true,
  minFrequency: 20,
  maxFrequency: 20_000,
  sampleRate: 48_000,
  seed: 42,
  precision: 'standard',
};

export const DETAILED_SMOOTHING_FRACTION = 12;
export const BROAD_SMOOTHING_FRACTION = 3;
export const MIN_PROMINENCE_DB = 1.5;
export const MIN_RELIABILITY = 0.45;
export const NULL_DEPTH_DB = 7;
export const NULL_MAX_BANDWIDTH_OCT = 0.35;
export const USABLE_RANGE_DROP_DB = 8;
export const BELOW_TARGET_BOOST_LIMIT_DB = 10;
export const MIN_FILTER_GAIN_DB = 0.3;
export const MIN_IMPROVEMENT_PERCENT = 0.15;
export const MIN_ITERATION_IMPROVEMENT_PERCENT = 0.3;
export const HEADROOM_DB = 0.8;
export const PREAMP_WARNING_DB = -8;
export const COST_ERROR_CLAMP_DB = 12;
export const DENSE_GRID_SIZE = 4096;
export const SIM_GRID_SIZE = 512;

export const FREQUENCY_OFFSETS_OCTAVES = [-1 / 24, -1 / 48, 0, 1 / 48, 1 / 24] as const;
export const Q_MULTIPLIERS = [0.7, 0.85, 1, 1.2, 1.45] as const;
export const GAIN_MULTIPLIERS = [0.6, 0.75, 0.9, 1] as const;

export const FREQUENCY_STEPS_OCTAVES = [1 / 12, 1 / 24, 1 / 48, 1 / 96] as const;
export const GAIN_STEPS_DB = [1, 0.5, 0.25, 0.1] as const;
export const Q_MULTIPLIERS_PER_STAGE = [1.5, 1.25, 1.1, 1.04] as const;

export const MAX_PK_RESONANCE = 12;
export const MAX_PK_TONAL = 2;
export const MAX_LOW_SHELF = 1;
export const MAX_HIGH_SHELF = 1;

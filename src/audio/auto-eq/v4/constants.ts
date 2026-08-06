import type { AutoEqV4Options, FrequencyPoint } from "./types";

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

export const DEFAULT_V4_OPTIONS: AutoEqV4Options = {
	targetType: "room",
	maxFilters: 16,
	allowBoosts: true,
	minFrequency: 20,
	maxFrequency: 20_000,
	sampleRate: 48_000,
	seed: 42,
	precisionMode: "maximum",
};

/** Fractional-octave scales used throughout the V4 pipeline (N in "1/N octave"). */
export const SCALE_FRACTIONS = {
	native: 24,
	fine: 12,
	mid: 6,
	broad: 3,
} as const;

/** Default multi-scale cost blend (overridden per-frequency by getScaleWeights). */
export const SCALE_WEIGHTS = {
	native: 0.45,
	fine: 0.3,
	mid: 0.15,
	broad: 0.1,
} as const;

export const MIN_RAW_POINTS = 40;
export const MIN_POINTS_PER_OCTAVE_FOR_V4 = 18;
/** Expected octave step for a native 1/24 grid (with tolerance in validation). */
export const EXPECTED_OCTAVE_STEP_1_24 = 1 / 24;
export const OCTAVE_STEP_TOLERANCE_RATIO = 0.35;

export const GRID_SIZE = 1024;
export const SIM_GRID_SIZE = 640;
export const DENSE_GRID = 8192;

export const MIN_RESONANCE_PROMINENCE_DB = 1.0;
export const MIN_RESONANCE_TARGET_EXCESS_DB = 1.0;
export const MIN_PROMINENCE_DB = MIN_RESONANCE_PROMINENCE_DB;
export const MIN_RELIABILITY = 0.45;
export const NULL_DEPTH_DB = 6;
export const NULL_MAX_BANDWIDTH_OCT = 0.35;
export const USABLE_RANGE_DROP_DB = 8;
export const BELOW_TARGET_BOOST_LIMIT_DB = 10;

export const MIN_TONAL_ERROR_DB = 1.25;
export const MIN_TONAL_WIDTH_OCTAVES = 0.4;
export const MIN_POSITIVE_ERROR_COVERAGE = 0.7;

export const MIN_FILTER_GAIN_DB = 0.25;
export const MIN_CONTRIBUTION_SHARE = 0.005;

export const HEADROOM_DB = 0.8;
export const PREAMP_WARNING_DB = -8;
export const COST_ERROR_CLAMP_DB = 12;
export const HUBER_DELTA = 2;

export const V4_CANDIDATE_BUDGET = {
	resonance: 48,
	tonal: 24,
	shelf: 8,
} as const;

export const CANDIDATES_PER_ITERATION = {
	resonance: 16,
	tonal: 10,
	shelf: 4,
} as const;

export const FREQUENCY_OFFSETS_OCTAVES = [
	-1 / 48,
	-1 / 96,
	0,
	1 / 96,
	1 / 48,
] as const;
export const Q_MULTIPLIERS = [0.7, 0.82, 0.92, 1, 1.1, 1.25, 1.45] as const;
export const GAIN_MULTIPLIERS = [0.5, 0.65, 0.78, 0.9, 1] as const;
export const TONAL_Q_VALUES = [0.3, 0.4, 0.55, 0.7, 0.9, 1.2, 1.5] as const;
export const SHELF_Q = 0.707;

export const BEAM_WIDTH = 8;
export const BEAM_BRANCHING = 6;
export const MULTI_START_COUNT = 4;

export const MAX_OPTIMIZER_PASSES = 15;
export const OPTIMIZATION_STAGES = {
	frequencyStepsOctaves: [1 / 24, 1 / 48, 1 / 96, 1 / 192] as const,
	gainStepsDb: [0.5, 0.25, 0.1, 0.05] as const,
	qMultipliersPerStage: [1.25, 1.12, 1.05, 1.025] as const,
} as const;

export interface V4SearchBudget {
	beamWidth: number;
	beamBranching: number;
	multiStartCount: number;
	maxOptimizerPasses: number;
	optimizationStageCount: number;
}

export function getV4SearchBudget(
	precisionMode: "balanced" | "maximum" = "maximum",
): V4SearchBudget {
	if (precisionMode === "balanced") {
		return {
			beamWidth: 4,
			beamBranching: 4,
			multiStartCount: 2,
			maxOptimizerPasses: 6,
			optimizationStageCount: 2,
		};
	}
	return {
		beamWidth: BEAM_WIDTH,
		beamBranching: BEAM_BRANCHING,
		multiStartCount: MULTI_START_COUNT,
		maxOptimizerPasses: MAX_OPTIMIZER_PASSES,
		optimizationStageCount: OPTIMIZATION_STAGES.frequencyStepsOctaves.length,
	};
}

export const MERGE_CORRELATION_THRESHOLD = 0.92;
export const MERGE_DISTANCE_OCTAVES = 1 / 12;
export const BOOST_PENALTY_COEFFICIENT = 5.94;
export const OVERLAP_DISTANCE_OCTAVES = 1 / 12;
export const CANCELLATION_DISTANCE_OCTAVES = 1 / 8;

export const MEDIAN_WORST_SPLIT = { median: 0.72, worst: 0.28 } as const;

export const MAX_SAFETY_PASS_ITERATIONS = 25;

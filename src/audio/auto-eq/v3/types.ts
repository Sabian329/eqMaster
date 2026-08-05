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

export type EqFilterType = "PK" | "LS" | "HS";

export type FilterReason =
	| "local-resonance"
	| "repeated-resonance"
	| "broad-tonal-error"
	| "low-frequency-tilt"
	| "high-frequency-tilt";

export interface GeneratedEqFilter {
	id: string;
	type: EqFilterType;
	frequency: number;
	gainDb: number;
	q: number;
	enabled: boolean;
	confidence: number;
	improvementPercent: number;
	contributionPercent: number;
	affectedRange: { fromHz: number; toHz: number };
	reason: FilterReason;
}

export type TargetType = "flat" | "room" | "custom";

export type AutoEqV3Warning =
	| "single-measurement-high-frequency-correction"
	| "low-repeatability"
	| "attempted-boost-outside-usable-range"
	| "excessive-required-headroom"
	| "measurement-near-noise-floor"
	| "insufficient-frequency-resolution"
	| "deep-null-detected"
	| "correction-limited-by-speaker-range"
	| "optimizer-stopped-early";

export type AutoEqV3StopReason =
	| "completed"
	| "no-improvement"
	| "minimum-improvement-not-met"
	| "max-filters-reached"
	| "regeneration-exhausted";

export interface AutoEqV3Options {
	targetType: TargetType;
	customTarget?: FrequencyPoint[];
	maxFilters: number;
	allowBoosts: boolean;
	fullRangeCorrection: boolean;
	minFrequency: number;
	maxFrequency: number;
	sampleRate: number;
	seed: number;
}

export interface AutoEqV3Progress {
	stage:
		| "preparing"
		| "analyzing"
		| "generating-candidates"
		| "selecting-filters"
		| "optimizing"
		| "regenerating"
		| "pruning"
		| "merging"
		| "finalizing";
	progress: number;
	currentCost?: number;
	filterCount?: number;
	iteration?: number;
}

export interface PreparedMeasurement {
	measured: FrequencyPoint[];
	detailed: FrequencyPoint[];
	broad: FrequencyPoint[];
	target: FrequencyPoint[];
	narrowResidual: FrequencyPoint[];
	tonalError: FrequencyPoint[];
	reliability: Float64Array;
	repeatabilityDb: Float64Array;
	measurementCount: number;
	usableBoostRange: { fromHz: number; toHz: number };
	targetType: TargetType;
	targetLevelOffsetDb: number;
	simGrid: FrequencyPoint[];
	warnings: AutoEqV3Warning[];
}

export interface ResonanceCandidate {
	frequency: number;
	prominenceDb: number;
	bandwidthOctaves: number;
	q: number;
	score: number;
	reason: FilterReason;
	reliability: number;
	isPotentialNull: boolean;
}

export interface TonalCandidate {
	frequency: number;
	errorDb: number;
	bandwidthOctaves: number;
	reason: FilterReason;
	reliability: number;
}

export interface ShelfCandidate {
	type: "LS" | "HS";
	frequency: number;
	errorDb: number;
	reason: FilterReason;
	reliability: number;
}

export interface FilterCandidate {
	type: EqFilterType;
	frequency: number;
	gainDb: number;
	q: number;
	reason: FilterReason;
	confidence: number;
	pool: "resonance" | "tonal" | "shelf";
}

export interface AutoEqV3Result {
	filters: GeneratedEqFilter[];
	preampDb: number;
	measured: FrequencyPoint[];
	broadMeasured: FrequencyPoint[];
	target: FrequencyPoint[];
	predicted: FrequencyPoint[];
	combinedFilterResponse: FrequencyPoint[];
	targetType: TargetType;
	targetLevelOffsetDb: number;
	errorBefore: number;
	errorAfter: number;
	rmsErrorBeforeDb: number;
	rmsErrorAfterDb: number;
	maximumErrorBeforeDb: number;
	maximumErrorAfterDb: number;
	weightedRmsBeforeDb: number;
	weightedRmsAfterDb: number;
	rmsImprovementPercent: number;
	candidateCount: {
		resonance: number;
		tonal: number;
		shelf: number;
		total: number;
	};
	acceptedCandidateCount: number;
	rejectedNullCount: number;
	rejectedSimilarFilterCount: number;
	prunedFilterCount: number;
	mergedFilterCount: number;
	maximumCombinedBoostDb: number;
	confidence: number;
	warnings: AutoEqV3Warning[];
	stopReason: AutoEqV3StopReason;
	regenerationCycles: number;
	optimizationPasses: number;
	executionTimeMs: number;
}

export interface CostBreakdown {
	total: number;
	medianMeasurementCost: number;
	worstMeasurementCost: number;
	boostPenalty: number;
	overlapPenalty: number;
	cancellationPenalty: number;
	qPenalty: number;
	headroomPenalty: number;
	filterCountPenalty: number;
}

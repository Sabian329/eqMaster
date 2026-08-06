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
	localImprovement?: number;
	offBandDamage?: number;
	weakenedBySafetyPass?: boolean;
	positiveErrorCoverage?: number;
	qualifiesForStrongBroadCut?: boolean;
}

export type TargetType = "flat" | "room" | "custom";

export interface ResolvedTarget {
	type: TargetType;
	points: FrequencyPoint[];
	levelOffsetDb: number;
	label: string;
}

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
		| "detecting-resonances"
		| "detecting-tonal-errors"
		| "generating-candidates"
		| "selecting-filters"
		| "optimizing"
		| "regenerating-candidates"
		| "pruning"
		| "merging"
		| "final-safety-pass"
		| "finalizing"
		// Legacy aliases kept for older UI progress strings during transition.
		| "analyzing"
		| "regenerating";
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
	resolvedTarget: ResolvedTarget;
	narrowResidual: FrequencyPoint[];
	tonalError: FrequencyPoint[];
	reliability: Float64Array;
	repeatabilityDb: Float64Array;
	measurementCount: number;
	usableBoostRange: { fromHz: number; toHz: number };
	targetType: TargetType;
	targetLevelOffsetDb: number;
	targetLabel: string;
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
	isHighConfidenceRepeated?: boolean;
}

export interface TonalCandidate {
	frequency: number;
	errorDb: number;
	bandwidthOctaves: number;
	reason: FilterReason;
	reliability: number;
	fromHz?: number;
	toHz?: number;
	positiveErrorCoverage?: number;
	averageExcessDb?: number;
	hasDominantDeepNull?: boolean;
	qualifiesForStrongBroadCut?: boolean;
}

export interface ShelfCandidate {
	type: "LS" | "HS";
	frequency: number;
	errorDb: number;
	reason: FilterReason;
	reliability: number;
	positiveErrorCoverage?: number;
	averageExcessDb?: number;
	hasDominantDeepNull?: boolean;
	qualifiesForStrongBroadCut?: boolean;
}

export interface FilterCandidate {
	type: EqFilterType;
	frequency: number;
	gainDb: number;
	q: number;
	reason: FilterReason;
	confidence: number;
	pool: "resonance" | "tonal" | "shelf";
	positiveErrorCoverage?: number;
	qualifiesForStrongBroadCut?: boolean;
}

export interface AutoEqV31Diagnostics {
	filtersBeforePruning: number;
	filtersAfterPruning: number;
	filtersAfterSafetyPass: number;
	resonanceCandidateCount: number;
	tonalCandidateCount: number;
	shelfCandidateCount: number;
	acceptedCandidateCount: number;
	rejectedCandidateCount: number;
	rejectedNullCount: number;
	rejectedOffBandDamageCount: number;
	rejectedOvercutCount: number;
	prunedFilterCount: number;
	weakenedFilterCount: number;
	mergedFilterCount: number;
	weightedRmsBeforeDb: number;
	weightedRmsAfterDb: number;
	broadRmsBeforeDb: number;
	broadRmsAfterDb: number;
	overcutAreaBeforeDbOct: number;
	overcutAreaAfterDbOct: number;
	excessAreaBeforeDbOct: number;
	excessAreaAfterDbOct: number;
	maximumBroadOvercutBeforeDb: number;
	maximumBroadOvercutAfterDb: number;
	maximumCombinedBoostDb: number;
	maximumCombinedCutDb: number;
	preampDb: number;
	stopReason: AutoEqV3StopReason;
	executionTimeMs: number;
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
	targetLabel: string;
	resolvedTarget: ResolvedTarget;
	errorBefore: number;
	errorAfter: number;
	rmsErrorBeforeDb: number;
	rmsErrorAfterDb: number;
	maximumErrorBeforeDb: number;
	maximumErrorAfterDb: number;
	weightedRmsBeforeDb: number;
	weightedRmsAfterDb: number;
	broadRmsBeforeDb: number;
	broadRmsAfterDb: number;
	overcutAreaBeforeDbOct: number;
	overcutAreaAfterDbOct: number;
	excessAreaBeforeDbOct: number;
	excessAreaAfterDbOct: number;
	maximumBroadOvercutBeforeDb: number;
	maximumBroadOvercutAfterDb: number;
	maximumCombinedCutDb: number;
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
	rejectedOffBandDamageCount: number;
	rejectedOvercutCount: number;
	prunedFilterCount: number;
	weakenedFilterCount: number;
	mergedFilterCount: number;
	filtersBeforePruning: number;
	filtersAfterPruning: number;
	filtersAfterSafetyPass: number;
	maximumCombinedBoostDb: number;
	confidence: number;
	warnings: AutoEqV3Warning[];
	stopReason: AutoEqV3StopReason;
	regenerationCycles: number;
	optimizationPasses: number;
	executionTimeMs: number;
	diagnostics: AutoEqV31Diagnostics;
}

export interface CostBreakdown {
	total: number;
	medianMeasurementCost: number;
	worstMeasurementCost: number;
	responseCost: number;
	boostPenalty: number;
	overlapPenalty: number;
	cancellationPenalty: number;
	qPenalty: number;
	highQPenalty: number;
	headroomPenalty: number;
	filterCountPenalty: number;
	offBandDamagePenalty: number;
	broadOvercutPenalty: number;
	broadCutLimitPenalty: number;
}

export interface FrequencyPoint {
	frequency: number;
	db: number;
}

export type EqFilterType = "PK" | "LS" | "HS";

export type V4FilterReason =
	| "modal-resonance"
	| "persistent-local-resonance"
	| "repeated-resonance"
	| "broad-tonal-excess"
	| "low-frequency-tilt"
	| "high-frequency-tilt"
	/** @deprecated Prefer modal-resonance / persistent-local-resonance */
	| "resonance"
	/** @deprecated Prefer broad-tonal-excess */
	| "tonal-region"
	/** @deprecated Prefer low-frequency-tilt */
	| "low-shelf"
	/** @deprecated Prefer high-frequency-tilt */
	| "high-shelf";

export type V4RejectedFeatureReason =
	| "deep-null"
	| "single-bin-artifact"
	| "comb-filtering"
	| "low-confidence"
	| "outside-usable-range"
	| "off-band-damage"
	| "broad-overcut"
	| "similar-filter"
	| "cancellation-risk";

export interface FeaturePersistence {
	adjacentBinSupport: number;
	scalePersistence: number;
	spatialPersistence: number;
	decayPersistence: number;
}

export interface V4GeneratedFilter {
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
	reason: V4FilterReason;
	localImprovement?: number;
	globalImprovement?: number;
	offBandDamage?: number;
	safetyAdjusted?: boolean;
	weakenedBySafetyPass?: boolean;
	scalePersistence?: number;
	spatialPersistence?: number;
	positiveErrorCoverage?: number;
	sourceRegionId?: string;
}

export type TargetType = "flat" | "room" | "custom";

export interface ResolvedV4Target {
	type: TargetType;
	points: FrequencyPoint[];
	points1_24: FrequencyPoint[];
	points1_12: FrequencyPoint[];
	points1_6: FrequencyPoint[];
	points1_3: FrequencyPoint[];
	levelOffsetDb: number;
	label: string;
}

export type AutoEqV4Warning =
	| "single-measurement-high-frequency-correction"
	| "low-repeatability"
	| "excessive-required-headroom"
	| "deep-null-detected"
	| "comb-artifact-detected"
	| "correction-limited-by-speaker-range"
	| "optimizer-stopped-early"
	| "v4-requires-native-1-24-data";

export type AutoEqV4StopReason =
	| "max-filters-reached"
	| "all-errors-within-tolerance"
	| "no-valid-candidates"
	| "improvement-below-threshold"
	| "remaining-errors-are-nulls"
	| "remaining-errors-are-comb-filtering"
	| "remaining-errors-outside-usable-range"
	| "beam-search-converged"
	| "optimization-cancelled"
	| "optimization-failed"
	| "completed"
	| "no-improvement"
	| "beam-exhausted";

export type V4PrecisionMode = "balanced" | "maximum";

export interface AutoEqV4Options {
	targetType: TargetType;
	customTarget?: FrequencyPoint[];
	maxFilters: number;
	allowBoosts: boolean;
	minFrequency: number;
	maxFrequency: number;
	sampleRate: number;
	seed: number;
	precisionMode: V4PrecisionMode;
}

export type AutoEqV4Stage =
	| "validating-1-24-data"
	| "preparing-multi-scale-response"
	| "detecting-resonances"
	| "detecting-tonal-regions"
	| "detecting-nulls"
	| "generating-candidates"
	| "beam-search"
	| "global-optimization"
	| "multi-start"
	| "pruning"
	| "merging"
	| "final-safety-pass"
	| "finalizing"
	/** Legacy aliases kept for existing callers */
	| "validating"
	| "preparing"
	| "optimizing"
	| "safety-pass";

export interface AutoEqV4Progress {
	stage: AutoEqV4Stage;
	progress: number;
	currentCost?: number;
	currentFilterCount?: number;
	filterCount?: number;
	beamSize?: number;
	optimizationPass?: number;
	iteration?: number;
	candidateCount?: {
		resonance: number;
		tonal: number;
		shelf: number;
	};
}

export interface V4MeasurementResolution {
	source: "raw-derived-1/24" | "native-1/24" | "unsupported";
	pointsPerOctave: number;
	isNativeResolution: boolean;
	medianOctaveStep: number;
	minimumOctaveStep?: number;
	maximumOctaveStep?: number;
	missingPointCount?: number;
	duplicatedPointCount?: number;
	invalidPointCount?: number;
	measurementCount: number;
}

export interface V4AnalysisPoint {
	frequency: number;
	measured1_24Db?: number;
	measured1_12Db?: number;
	measured1_6Db?: number;
	measured1_3Db?: number;
	targetDb?: number;
	errorDb?: number;
	reliability: number;
	correctability?: number;
	isDeepNull: boolean;
	isCombFiltering?: boolean;
	isCombArtifact: boolean;
	isSingleBinArtifact?: boolean;
	isPersistentPeak?: boolean;
	requiresBoost: boolean;
	boostAllowed: boolean;
	requiresCut: boolean;
	isOutsideUsableRange: boolean;
}

export interface MultiScaleCurves {
	native1_24: FrequencyPoint[];
	octave1_12: FrequencyPoint[];
	octave1_6: FrequencyPoint[];
	octave1_3: FrequencyPoint[];
}

export type V4MultiScaleResponse = MultiScaleCurves;

export interface PreparedV4Measurement extends MultiScaleCurves {
	grid: FrequencyPoint[];
	simGrid: FrequencyPoint[];
	denseGrid: FrequencyPoint[];
	target: FrequencyPoint[];
	resolvedTarget: ResolvedV4Target;
	narrowResidual: FrequencyPoint[];
	tonalError: FrequencyPoint[];
	broadExcess: FrequencyPoint[];
	reliability: Float64Array;
	repeatabilityDb: Float64Array;
	analysisPoints: V4AnalysisPoint[];
	measurementCount: number;
	usableBoostRange: { fromHz: number; toHz: number };
	targetType: TargetType;
	targetLevelOffsetDb: number;
	targetLabel: string;
	resolution: V4MeasurementResolution;
	warnings: AutoEqV4Warning[];
}

export interface V4ResonanceCandidate {
	frequency: number;
	prominenceDb: number;
	bandwidthOctaves: number;
	q: number;
	score: number;
	reason: V4FilterReason;
	reliability: number;
	isPotentialNull: boolean;
	scalePersistence: number;
	spatialPersistence?: number;
	isCombArtifact: boolean;
	isSingleBinArtifact?: boolean;
}

export interface V4TonalRegion {
	frequency: number;
	fromHz: number;
	toHz: number;
	errorDb: number;
	bandwidthOctaves: number;
	reliability: number;
	positiveErrorCoverage: number;
	averageExcessDb: number;
	hasDominantDeepNull: boolean;
}

export interface V4ShelfCandidate {
	type: "LS" | "HS";
	frequency: number;
	errorDb: number;
	reliability: number;
	positiveErrorCoverage: number;
	averageExcessDb: number;
	hasDominantDeepNull: boolean;
}

export type V4CandidatePool = "resonance" | "tonal" | "shelf";

export interface V4FilterCandidate {
	type: EqFilterType;
	frequency: number;
	gainDb: number;
	q: number;
	reason: V4FilterReason;
	confidence: number;
	pool: V4CandidatePool;
	scalePersistence?: number;
	positiveErrorCoverage?: number;
}

export interface V4CandidateEvaluation {
	globalCostBefore: number;
	globalCostAfter: number;
	localCostBefore: number;
	localCostAfter: number;
	offBandCostBefore: number;
	offBandCostAfter: number;
	broadCostBefore: number;
	broadCostAfter: number;
	globalImprovement: number;
	localImprovement: number;
	offBandDamage: number;
	broadDamage: number;
}

export interface V4CostBreakdown {
	total: number;
	scaleCost: number;
	overcutPenalty: number;
	broadCutLimitPenalty: number;
	boostPenalty: number;
	highQPenalty: number;
	overlapPenalty: number;
	cancellationPenalty: number;
	headroomPenalty: number;
	filterCountPenalty: number;
	offBandDamagePenalty: number;
}

export interface AutoEqV4Diagnostics {
	nativePointCount: number;
	missingPointCount: number;
	resonanceCandidateCount: number;
	tonalCandidateCount: number;
	shelfCandidateCount: number;
	acceptedCandidateCount: number;
	rejectedCandidateCount: number;
	rejectedSingleBinCount: number;
	rejectedNullCount: number;
	rejectedCombFilteringCount: number;
	rejectedCombArtifactCount: number;
	rejectedLowConfidenceCount: number;
	rejectedOffBandDamageCount: number;
	rejectedOvercutCount: number;
	rejectedSimilarFilterCount: number;
	beamIterations: number;
	beamBestCost: number;
	optimizationPasses: number;
	multiStartCount: number;
	beamWidthUsed: number;
	filtersBeforePruning: number;
	filtersAfterPruning: number;
	filtersAfterMerging: number;
	filtersAfterSafetyPass: number;
	prunedFilterCount: number;
	weakenedFilterCount: number;
	mergedFilterCount: number;
	weightedRmsBeforeDb: number;
	weightedRmsAfterDb: number;
	weightedRms1_24BeforeDb: number;
	weightedRms1_24AfterDb: number;
	weightedRms1_12BeforeDb: number;
	weightedRms1_12AfterDb: number;
	broadRmsBeforeDb: number;
	broadRmsAfterDb: number;
	overcutAreaBeforeDbOct: number;
	overcutAreaAfterDbOct: number;
	maximumCombinedBoostDb: number;
	maximumCombinedCutDb: number;
	maximumScaleConflict: number;
	preampDb: number;
	stopReason: AutoEqV4StopReason;
	executionTimeMs: number;
}

export interface AutoEqV4Result {
	version: "v4";
	filters: V4GeneratedFilter[];
	preampDb: number;
	measured: FrequencyPoint[];
	measured1_24: FrequencyPoint[];
	measured1_12: FrequencyPoint[];
	measured1_6: FrequencyPoint[];
	measured1_3: FrequencyPoint[];
	broadMeasured: FrequencyPoint[];
	target: FrequencyPoint[];
	target1_24: FrequencyPoint[];
	target1_12: FrequencyPoint[];
	target1_6: FrequencyPoint[];
	target1_3: FrequencyPoint[];
	predicted: FrequencyPoint[];
	predicted1_24: FrequencyPoint[];
	predicted1_12: FrequencyPoint[];
	predicted1_6: FrequencyPoint[];
	predicted1_3: FrequencyPoint[];
	combinedFilterResponse: FrequencyPoint[];
	targetType: TargetType;
	targetLevelOffsetDb: number;
	targetLabel: string;
	resolvedTarget: ResolvedV4Target;
	resolution: V4MeasurementResolution;
	errorBefore: number;
	errorAfter: number;
	rmsErrorBeforeDb: number;
	rmsErrorAfterDb: number;
	maximumErrorBeforeDb: number;
	maximumErrorAfterDb: number;
	weightedRmsBeforeDb: number;
	weightedRmsAfterDb: number;
	weightedRms1_24BeforeDb: number;
	weightedRms1_24AfterDb: number;
	weightedRms1_12BeforeDb: number;
	weightedRms1_12AfterDb: number;
	broadRmsBeforeDb: number;
	broadRmsAfterDb: number;
	overcutAreaBeforeDbOct: number;
	overcutAreaAfterDbOct: number;
	excessAreaBeforeDbOct: number;
	excessAreaAfterDbOct: number;
	maximumBroadOvercutDb: number;
	rmsImprovementPercent: number;
	maximumCombinedBoostDb: number;
	maximumCombinedCutDb: number;
	confidence: number;
	warnings: AutoEqV4Warning[];
	stopReason: AutoEqV4StopReason;
	executionTimeMs: number;
	diagnostics: AutoEqV4Diagnostics;
}

import { DEFAULT_V4_OPTIONS, getV4SearchBudget } from "./constants";
import { beamSearch } from "./beamSearch";
import { buildV4CandidatePools, resetV4CandidateCounter } from "./candidateGeneration";
import { optimizeV4Filters } from "./globalOptimizer";
import { clamp } from "./math";
import { mergeV4Filters } from "./merging";
import { computeV4ErrorMetrics } from "./metrics";
import {
	calculateV4TotalCost,
	computeCombinedFilterResponse,
	computePredictedCurve,
} from "./multiScaleCost";
import { calculateV4PreampDb } from "./preamp";
import { clampFilterFrequency, prepareMeasurement } from "./prepareMeasurement";
import { pruneV4Filters } from "./pruning";
import { detectResonances } from "./resonanceDetection";
import { runV4SafetyPass } from "./safetyPass";
import { detectShelves, detectTonalOnly } from "./shelfDetection";
import type {
	AutoEqV4Diagnostics,
	AutoEqV4Options,
	AutoEqV4Progress,
	AutoEqV4Result,
	AutoEqV4StopReason,
	AutoEqV4Warning,
	FrequencyPoint,
} from "./types";

export type AutoEqV4ProgressCallback = (progress: AutoEqV4Progress) => void;

export function resolveAutoEqV4Options(
	partial: Partial<AutoEqV4Options> = {},
): AutoEqV4Options {
	return {
		targetType: partial.targetType ?? DEFAULT_V4_OPTIONS.targetType,
		customTarget: partial.customTarget,
		maxFilters: partial.maxFilters ?? DEFAULT_V4_OPTIONS.maxFilters,
		allowBoosts: partial.allowBoosts ?? DEFAULT_V4_OPTIONS.allowBoosts,
		minFrequency: partial.minFrequency ?? DEFAULT_V4_OPTIONS.minFrequency,
		maxFrequency: partial.maxFrequency ?? DEFAULT_V4_OPTIONS.maxFrequency,
		sampleRate: partial.sampleRate ?? DEFAULT_V4_OPTIONS.sampleRate,
		seed: partial.seed ?? DEFAULT_V4_OPTIONS.seed,
		precisionMode: partial.precisionMode ?? DEFAULT_V4_OPTIONS.precisionMode,
	};
}

/**
 * Auto EQ V4 pipeline: derives native 1/24-octave data from RAW measurement
 * curves, then runs resonance/tonal-region/shelf detection, beam search,
 * multi-start coordinate-descent optimization, pruning, merging and a final
 * broad-scale safety pass. Throws with a message containing
 * "v4-requires-native-1-24-data" if the supplied curves aren't RAW/dense
 * enough to derive a genuine native 1/24-octave curve.
 */
export function generateAutoEqV4(
	measurements: FrequencyPoint[][],
	partialOptions: Partial<AutoEqV4Options> = {},
	onProgress?: AutoEqV4ProgressCallback,
): AutoEqV4Result {
	const startedAt = performance.now();
	const options = resolveAutoEqV4Options(partialOptions);
	resetV4CandidateCounter();

	onProgress?.({ stage: "validating-1-24-data", progress: 0.02 });
	onProgress?.({ stage: "preparing-multi-scale-response", progress: 0.05 });
	const prepared = prepareMeasurement(measurements, options);
	const warnings: AutoEqV4Warning[] = [...prepared.warnings];

	onProgress?.({ stage: "detecting-nulls", progress: 0.08 });
	onProgress?.({ stage: "detecting-resonances", progress: 0.1 });
	const beforeMetrics = computeV4ErrorMetrics(prepared, [], options);
	const initialCost = calculateV4TotalCost(prepared, [], options).total;
	const resonances = detectResonances(prepared);
	const rejectedNullCount = resonances.filter((entry) => entry.isPotentialNull).length;
	const rejectedSingleBinCount = resonances.filter(
		(entry) => entry.isSingleBinArtifact,
	).length;
	const rejectedCombFilteringCount = prepared.analysisPoints.filter(
		(point) => point.isCombArtifact || point.isCombFiltering,
	).length;

	onProgress?.({ stage: "detecting-tonal-regions", progress: 0.14 });
	const tonalRegions = detectTonalOnly(prepared);
	const shelves = detectShelves(prepared);

	onProgress?.({ stage: "generating-candidates", progress: 0.18 });
	const initialPools = buildV4CandidatePools(prepared, options, resonances, tonalRegions, shelves);

	onProgress?.({
		stage: "beam-search",
		progress: 0.22,
		candidateCount: {
			resonance: initialPools.resonance.length,
			tonal: initialPools.tonal.length,
			shelf: initialPools.shelf.length,
		},
	});
	const beamResult = beamSearch(prepared, options, onProgress);
	let filters = beamResult.filters;
	let stopReason: AutoEqV4StopReason = beamResult.stopReason;

	onProgress?.({
		stage: "multi-start",
		progress: 0.55,
		currentFilterCount: filters.length,
		filterCount: filters.length,
	});
	onProgress?.({
		stage: "global-optimization",
		progress: 0.58,
		currentFilterCount: filters.length,
		filterCount: filters.length,
	});
	filters = optimizeV4Filters(filters, prepared, options, onProgress);

	onProgress?.({ stage: "pruning", progress: 0.82, filterCount: filters.length });
	const filtersBeforePruning = filters.length;
	const pruneResult = pruneV4Filters(filters, prepared, options, initialCost);
	filters = pruneResult.filters;
	const filtersAfterPruning = filters.length;
	const prunedFilterCount = Math.max(0, filtersBeforePruning - filtersAfterPruning);
	let weakenedFilterCount = pruneResult.weakenedFilterCount;

	onProgress?.({ stage: "merging", progress: 0.86, filterCount: filters.length });
	const beforeMergeCount = filters.length;
	filters = mergeV4Filters(filters, prepared, options);
	const filtersAfterMerging = filters.length;
	const mergedFilterCount = Math.max(0, beforeMergeCount - filters.length);

	filters = optimizeV4Filters(filters, prepared, options, onProgress);

	onProgress?.({
		stage: "final-safety-pass",
		progress: 0.9,
		filterCount: filters.length,
	});
	const safetyResult = runV4SafetyPass(filters, prepared, options);
	filters = safetyResult.filters.map((filter) => ({
		...filter,
		frequency: clampFilterFrequency(filter.frequency, filter.type, filter.reason, options),
		safetyAdjusted: filter.weakenedBySafetyPass ?? filter.safetyAdjusted,
	}));
	weakenedFilterCount += safetyResult.weakenedFilterCount;
	const filtersAfterSafetyPass = filters.length;

	onProgress?.({ stage: "finalizing", progress: 0.92, filterCount: filters.length });

	const {
		preampDb,
		maximumCombinedBoostDb,
		maximumCombinedCutDb,
		warnings: preampWarnings,
	} = calculateV4PreampDb(filters, prepared.denseGrid, options);
	warnings.push(...preampWarnings);

	const afterMetrics = computeV4ErrorMetrics(prepared, filters, options);
	const weightedRmsBeforeDb = beforeMetrics.weightedRmsErrorDb;
	const weightedRmsAfterDb = afterMetrics.weightedRmsErrorDb;
	const rmsImprovementPercent =
		((weightedRmsBeforeDb - weightedRmsAfterDb) / Math.max(weightedRmsBeforeDb, 1e-9)) * 100;

	const combinedFilterResponse = computeCombinedFilterResponse(
		filters,
		prepared.grid,
		options.sampleRate,
	);
	const filterResponseDb = combinedFilterResponse.map((point) => point.db);

	const predicted1_24 = computePredictedCurve(prepared.native1_24, filterResponseDb);
	const predicted1_12 = computePredictedCurve(prepared.octave1_12, filterResponseDb);
	const predicted1_6 = computePredictedCurve(prepared.octave1_6, filterResponseDb);
	const predicted1_3 = computePredictedCurve(prepared.octave1_3, filterResponseDb);
	const predicted = predicted1_12;

	const improvementPercent =
		((beforeMetrics.scalarError - afterMetrics.scalarError) /
			Math.max(beforeMetrics.scalarError, 1e-6)) *
		100;
	const confidence = clamp(
		0.35 +
			(prepared.measurementCount > 1 ? 0.2 : 0) +
			Math.min(0.35, improvementPercent / 100) +
			Math.min(0.1, filters.length / options.maxFilters / 2),
		0,
		1,
	);

	if (afterMetrics.scalarError >= beforeMetrics.scalarError) {
		warnings.push("optimizer-stopped-early");
	}
	if (filters.length > 0 && (stopReason === "no-improvement" || stopReason === "beam-exhausted")) {
		stopReason = "beam-search-converged";
	}
	if (filters.length === 0 && stopReason === "completed") {
		stopReason = "no-valid-candidates";
	}

	const executionTimeMs = performance.now() - startedAt;

	const searchBudget = getV4SearchBudget(options.precisionMode);
	const diagnostics: AutoEqV4Diagnostics = {
		nativePointCount: prepared.native1_24.length,
		missingPointCount: prepared.resolution.missingPointCount ?? 0,
		resonanceCandidateCount: initialPools.resonance.length,
		tonalCandidateCount: initialPools.tonal.length,
		shelfCandidateCount: initialPools.shelf.length,
		acceptedCandidateCount: filters.length,
		rejectedCandidateCount: Math.max(0, initialPools.all.length - filters.length),
		rejectedSingleBinCount,
		rejectedNullCount,
		rejectedCombFilteringCount,
		rejectedCombArtifactCount: rejectedCombFilteringCount,
		rejectedLowConfidenceCount: 0,
		rejectedOffBandDamageCount: 0,
		rejectedOvercutCount: 0,
		rejectedSimilarFilterCount: 0,
		beamIterations: beamResult.iterations,
		beamBestCost: beamResult.bestCost,
		optimizationPasses: 0,
		multiStartCount: searchBudget.multiStartCount,
		beamWidthUsed: searchBudget.beamWidth,
		filtersBeforePruning,
		filtersAfterPruning,
		filtersAfterMerging,
		filtersAfterSafetyPass,
		prunedFilterCount,
		weakenedFilterCount,
		mergedFilterCount,
		weightedRmsBeforeDb,
		weightedRmsAfterDb,
		weightedRms1_24BeforeDb: beforeMetrics.weightedRms1_24Db,
		weightedRms1_24AfterDb: afterMetrics.weightedRms1_24Db,
		weightedRms1_12BeforeDb: beforeMetrics.weightedRms1_12Db,
		weightedRms1_12AfterDb: afterMetrics.weightedRms1_12Db,
		broadRmsBeforeDb: beforeMetrics.broadRmsDb,
		broadRmsAfterDb: afterMetrics.broadRmsDb,
		overcutAreaBeforeDbOct: beforeMetrics.overcutAreaDbOct,
		overcutAreaAfterDbOct: afterMetrics.overcutAreaDbOct,
		maximumCombinedBoostDb,
		maximumCombinedCutDb,
		maximumScaleConflict: 0,
		preampDb,
		stopReason,
		executionTimeMs,
	};

	onProgress?.({
		stage: "finalizing",
		progress: 1,
		filterCount: filters.length,
		currentCost: afterMetrics.scalarError,
	});

	return {
		version: "v4",
		filters,
		preampDb,
		measured: prepared.octave1_12,
		measured1_24: prepared.native1_24,
		measured1_12: prepared.octave1_12,
		measured1_6: prepared.octave1_6,
		measured1_3: prepared.octave1_3,
		broadMeasured: prepared.octave1_3,
		target: prepared.target,
		target1_24: prepared.resolvedTarget.points1_24,
		target1_12: prepared.resolvedTarget.points1_12,
		target1_6: prepared.resolvedTarget.points1_6,
		target1_3: prepared.resolvedTarget.points1_3,
		predicted,
		predicted1_24,
		predicted1_12,
		predicted1_6,
		predicted1_3,
		combinedFilterResponse,
		targetType: prepared.targetType,
		targetLevelOffsetDb: prepared.targetLevelOffsetDb,
		targetLabel: prepared.targetLabel,
		resolvedTarget: prepared.resolvedTarget,
		resolution: prepared.resolution,
		errorBefore: beforeMetrics.scalarError,
		errorAfter: afterMetrics.scalarError,
		rmsErrorBeforeDb: beforeMetrics.rmsErrorDb,
		rmsErrorAfterDb: afterMetrics.rmsErrorDb,
		maximumErrorBeforeDb: beforeMetrics.maximumErrorDb,
		maximumErrorAfterDb: afterMetrics.maximumErrorDb,
		weightedRmsBeforeDb,
		weightedRmsAfterDb,
		weightedRms1_24BeforeDb: beforeMetrics.weightedRms1_24Db,
		weightedRms1_24AfterDb: afterMetrics.weightedRms1_24Db,
		weightedRms1_12BeforeDb: beforeMetrics.weightedRms1_12Db,
		weightedRms1_12AfterDb: afterMetrics.weightedRms1_12Db,
		broadRmsBeforeDb: beforeMetrics.broadRmsDb,
		broadRmsAfterDb: afterMetrics.broadRmsDb,
		overcutAreaBeforeDbOct: beforeMetrics.overcutAreaDbOct,
		overcutAreaAfterDbOct: afterMetrics.overcutAreaDbOct,
		excessAreaBeforeDbOct: beforeMetrics.excessAreaDbOct,
		excessAreaAfterDbOct: afterMetrics.excessAreaDbOct,
		maximumBroadOvercutDb: afterMetrics.maximumBroadOvercutDb,
		rmsImprovementPercent,
		maximumCombinedBoostDb,
		maximumCombinedCutDb,
		confidence,
		warnings,
		stopReason,
		executionTimeMs,
		diagnostics,
	};
}

export * from "./types";
export * from "./constants";

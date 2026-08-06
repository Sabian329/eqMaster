import { DEFAULT_V3_OPTIONS, REGENERATION_CYCLES } from "./constants";
import {
	buildCandidatePools,
	clampHighFrequencyTonalGain,
	resetCandidateCounter,
} from "./candidatePool";
import {
	computeCombinedFilterResponse,
	computePredictedCurve,
	calculateTotalCost,
} from "./costFunction";
import { mergeSimilarFilters } from "./filterMerging";
import { pruneFilters } from "./filterPruning";
import { removeOverlappingTonalFilters } from "./filterSimilarity";
import { runFinalSafetyPass } from "./finalSafetyPass";
import { globalOptimization } from "./globalOptimizer";
import { initialFilterSelection } from "./initialSelection";
import { interpolateLogarithmically } from "./math";
import { computeAfterMetrics, computeBeforeMetrics } from "./metrics";
import {
	computeBroadRmsErrorDb,
	computeExcessAreaDbOct,
	computeMaximumBroadOvercutDb,
	computeOvercutAreaDbOct,
} from "./overcut";
import {
	clampFilterFrequency,
	prepareMeasurement,
	refreshPreparedResidual,
} from "./prepareMeasurement";
import { calculatePreampDb } from "./preamp";
import { detectResonanceCandidates } from "./resonanceCandidates";
import { detectShelfCandidates } from "./shelfCandidates";
import { detectTonalCandidates } from "./tonalCandidates";
import type {
	AutoEqV3Options,
	AutoEqV3Progress,
	AutoEqV3Result,
	AutoEqV3StopReason,
	AutoEqV3Warning,
	AutoEqV31Diagnostics,
	FrequencyPoint,
} from "./types";

export type AutoEqV3ProgressCallback = (progress: AutoEqV3Progress) => void;

export function resolveAutoEqV3Options(
	partial: Partial<AutoEqV3Options> = {},
): AutoEqV3Options {
	return {
		targetType: partial.targetType ?? DEFAULT_V3_OPTIONS.targetType,
		customTarget: partial.customTarget,
		maxFilters: partial.maxFilters ?? DEFAULT_V3_OPTIONS.maxFilters,
		allowBoosts: partial.allowBoosts ?? DEFAULT_V3_OPTIONS.allowBoosts,
		fullRangeCorrection:
			partial.fullRangeCorrection ?? DEFAULT_V3_OPTIONS.fullRangeCorrection,
		minFrequency: partial.minFrequency ?? DEFAULT_V3_OPTIONS.minFrequency,
		maxFrequency: partial.maxFrequency ?? DEFAULT_V3_OPTIONS.maxFrequency,
		sampleRate: partial.sampleRate ?? DEFAULT_V3_OPTIONS.sampleRate,
		seed: partial.seed ?? DEFAULT_V3_OPTIONS.seed,
	};
}

export function generateAutoEqV3(
	measurements: FrequencyPoint[][],
	partialOptions: Partial<AutoEqV3Options> = {},
	onProgress?: AutoEqV3ProgressCallback,
): AutoEqV3Result {
	if (measurements.length === 0) {
		throw new Error("At least one measurement is required.");
	}

	const startedAt = performance.now();
	const options = resolveAutoEqV3Options(partialOptions);
	resetCandidateCounter();

	onProgress?.({ stage: "preparing", progress: 0.05 });

	const prepared = prepareMeasurement(measurements, options);
	const warnings: AutoEqV3Warning[] = [...prepared.warnings];

	const alignedMeasurements = measurements.map((points) =>
		prepared.detailed.map((gridPoint) => ({
			frequency: gridPoint.frequency,
			db: interpolateLogarithmically(points, gridPoint.frequency),
		})),
	);

	onProgress?.({ stage: "detecting-resonances", progress: 0.1 });
	const beforeMetrics = computeBeforeMetrics(prepared, options);
	const emptyPredicted = computePredictedCurve(prepared, [], options);
	const broadRmsBeforeDb = computeBroadRmsErrorDb(
		emptyPredicted,
		prepared.target,
	);
	const overcutAreaBeforeDbOct = computeOvercutAreaDbOct(
		emptyPredicted,
		prepared.target,
	);
	const excessAreaBeforeDbOct = computeExcessAreaDbOct(
		emptyPredicted,
		prepared.target,
	);
	const maximumBroadOvercutBeforeDb = computeMaximumBroadOvercutDb(
		emptyPredicted,
		prepared.target,
	);
	const initialCost = calculateTotalCost(
		prepared,
		alignedMeasurements,
		[],
		options,
	).total;

	onProgress?.({ stage: "detecting-tonal-errors", progress: 0.14 });

	const resonances = detectResonanceCandidates(prepared);
	const tonalSegments = detectTonalCandidates(prepared);

	onProgress?.({ stage: "generating-candidates", progress: 0.18 });

	const shelves = detectShelfCandidates(prepared);
	const rejectedNullCount = resonances.filter(
		(item) => item.isPotentialNull,
	).length;
	const initialPools = buildCandidatePools(
		prepared,
		options,
		resonances,
		tonalSegments,
		shelves,
	);

	const selectionResult = initialFilterSelection(
		prepared,
		alignedMeasurements,
		options,
		onProgress,
	);

	let filters = selectionResult.filters;
	let stopReason: AutoEqV3StopReason = selectionResult.stopReason;
	let rejectedOffBandDamageCount =
		selectionResult.rejectedOffBandDamageCount;
	let rejectedOvercutCount = selectionResult.rejectedOvercutCount;
	let rejectedCandidateCount = selectionResult.rejectedCandidateCount;

	filters = globalOptimization(
		filters,
		prepared,
		alignedMeasurements,
		options,
		onProgress,
	);

	let regenerationCycles = 0;
	for (let cycle = 0; cycle < REGENERATION_CYCLES; cycle += 1) {
		onProgress?.({
			stage: "regenerating-candidates",
			progress: 0.75 + (cycle / REGENERATION_CYCLES) * 0.05,
			filterCount: filters.length,
			iteration: cycle,
		});

		const workingPrepared = refreshPreparedResidual(prepared, filters, options);
		const refreshedResonances = detectResonanceCandidates(workingPrepared);
		const refreshedTonal = detectTonalCandidates(workingPrepared);
		const refreshedShelves = detectShelfCandidates(workingPrepared);
		buildCandidatePools(
			workingPrepared,
			options,
			refreshedResonances,
			refreshedTonal,
			refreshedShelves,
		);

		const beforeCount = filters.length;
		const regenerated = initialFilterSelection(
			workingPrepared,
			alignedMeasurements,
			options,
			onProgress,
			filters,
		);

		rejectedOffBandDamageCount += regenerated.rejectedOffBandDamageCount;
		rejectedOvercutCount += regenerated.rejectedOvercutCount;
		rejectedCandidateCount += regenerated.rejectedCandidateCount;

		if (regenerated.filters.length <= beforeCount) {
			stopReason = "regeneration-exhausted";
			break;
		}

		filters = globalOptimization(
			regenerated.filters.slice(0, options.maxFilters),
			prepared,
			alignedMeasurements,
			options,
			onProgress,
		);
		regenerationCycles += 1;
	}

	filters = removeOverlappingTonalFilters(
		filters,
		prepared.detailed,
		options.sampleRate,
	);

	onProgress?.({
		stage: "pruning",
		progress: 0.82,
		filterCount: filters.length,
	});

	const filtersBeforePruning = filters.length;
	const pruneResult = pruneFilters(
		filters,
		prepared,
		alignedMeasurements,
		options,
		initialCost,
	);
	filters = pruneResult.filters;
	const filtersAfterPruning = filters.length;
	const prunedFilterCount = Math.max(
		0,
		filtersBeforePruning - filtersAfterPruning,
	);
	let weakenedFilterCount = pruneResult.weakenedFilterCount;

	onProgress?.({
		stage: "merging",
		progress: 0.86,
		filterCount: filters.length,
	});

	const beforeMergeCount = filters.length;
	filters = mergeSimilarFilters(
		filters,
		prepared,
		alignedMeasurements,
		options,
	);
	const mergedFilterCount = Math.max(0, beforeMergeCount - filters.length);

	filters = globalOptimization(
		filters,
		prepared,
		alignedMeasurements,
		options,
		onProgress,
	);

	onProgress?.({
		stage: "final-safety-pass",
		progress: 0.9,
		filterCount: filters.length,
	});

	const safetyResult = runFinalSafetyPass(
		filters,
		prepared,
		alignedMeasurements,
		options,
	);
	filters = safetyResult.filters.map((filter) => {
		const clone = clampHighFrequencyTonalGain(filter);
		clone.frequency = clampFilterFrequency(
			clone.frequency,
			clone.type,
			clone.reason,
			options,
		);
		return clone;
	});
	weakenedFilterCount += safetyResult.weakenedFilterCount;
	const filtersAfterSafetyPass = filters.length;

	onProgress?.({
		stage: "finalizing",
		progress: 0.92,
		filterCount: filters.length,
	});

	const {
		preampDb,
		maximumCombinedBoostDb,
		maximumCombinedCutDb,
		warnings: preampWarnings,
	} = calculatePreampDb(filters, options);
	warnings.push(...preampWarnings);

	const afterMetrics = computeAfterMetrics(prepared, filters, options);
	const weightedRmsBeforeDb = beforeMetrics.weightedRmsErrorDb;
	const weightedRmsAfterDb = afterMetrics.weightedRmsErrorDb;
	const rmsImprovementPercent =
		((weightedRmsBeforeDb - weightedRmsAfterDb) /
			Math.max(weightedRmsBeforeDb, 1e-9)) *
		100;
	const predicted = computePredictedCurve(prepared, filters, options);
	const combinedFilterResponse = computeCombinedFilterResponse(
		filters,
		prepared.detailed,
		options.sampleRate,
	);

	const broadRmsAfterDb = computeBroadRmsErrorDb(predicted, prepared.target);
	const overcutAreaAfterDbOct = computeOvercutAreaDbOct(
		predicted,
		prepared.target,
	);
	const excessAreaAfterDbOct = computeExcessAreaDbOct(
		predicted,
		prepared.target,
	);
	const maximumBroadOvercutAfterDb = computeMaximumBroadOvercutDb(
		predicted,
		prepared.target,
	);

	const improvementPercent =
		((beforeMetrics.scalarError - afterMetrics.scalarError) /
			Math.max(beforeMetrics.scalarError, 1e-6)) *
		100;

	const confidence = Math.max(
		0,
		Math.min(
			1,
			0.35 +
				(prepared.measurementCount > 1 ? 0.2 : 0) +
				Math.min(0.35, improvementPercent / 100) +
				Math.min(0.1, filters.length / options.maxFilters / 2),
		),
	);

	if (afterMetrics.scalarError >= beforeMetrics.scalarError) {
		warnings.push("optimizer-stopped-early");
	}

	if (filters.length > 0 && stopReason === "no-improvement") {
		stopReason = "completed";
	}

	const executionTimeMs = performance.now() - startedAt;

	const diagnostics: AutoEqV31Diagnostics = {
		filtersBeforePruning,
		filtersAfterPruning,
		filtersAfterSafetyPass,
		resonanceCandidateCount: initialPools.resonance.length,
		tonalCandidateCount: initialPools.tonal.length,
		shelfCandidateCount: initialPools.shelf.length,
		acceptedCandidateCount: filters.length,
		rejectedCandidateCount,
		rejectedNullCount,
		rejectedOffBandDamageCount,
		rejectedOvercutCount,
		prunedFilterCount,
		weakenedFilterCount,
		mergedFilterCount,
		weightedRmsBeforeDb,
		weightedRmsAfterDb,
		broadRmsBeforeDb,
		broadRmsAfterDb,
		overcutAreaBeforeDbOct,
		overcutAreaAfterDbOct,
		excessAreaBeforeDbOct,
		excessAreaAfterDbOct,
		maximumBroadOvercutBeforeDb,
		maximumBroadOvercutAfterDb,
		maximumCombinedBoostDb,
		maximumCombinedCutDb,
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
		filters,
		preampDb,
		measured: prepared.detailed,
		broadMeasured: prepared.broad,
		target: prepared.target,
		predicted,
		combinedFilterResponse,
		targetType: prepared.targetType,
		targetLevelOffsetDb: prepared.targetLevelOffsetDb,
		targetLabel: prepared.targetLabel,
		resolvedTarget: prepared.resolvedTarget,
		errorBefore: beforeMetrics.scalarError,
		errorAfter: afterMetrics.scalarError,
		rmsErrorBeforeDb: beforeMetrics.rmsErrorDb,
		rmsErrorAfterDb: afterMetrics.rmsErrorDb,
		maximumErrorBeforeDb: beforeMetrics.maximumErrorDb,
		maximumErrorAfterDb: afterMetrics.maximumErrorDb,
		weightedRmsBeforeDb,
		weightedRmsAfterDb,
		broadRmsBeforeDb,
		broadRmsAfterDb,
		overcutAreaBeforeDbOct,
		overcutAreaAfterDbOct,
		excessAreaBeforeDbOct,
		excessAreaAfterDbOct,
		maximumBroadOvercutBeforeDb,
		maximumBroadOvercutAfterDb,
		maximumCombinedCutDb,
		rmsImprovementPercent,
		candidateCount: {
			resonance: initialPools.resonance.length,
			tonal: initialPools.tonal.length,
			shelf: initialPools.shelf.length,
			total: initialPools.all.length,
		},
		acceptedCandidateCount: filters.length,
		rejectedNullCount,
		rejectedSimilarFilterCount: 0,
		rejectedOffBandDamageCount,
		rejectedOvercutCount,
		prunedFilterCount,
		weakenedFilterCount,
		mergedFilterCount,
		filtersBeforePruning,
		filtersAfterPruning,
		filtersAfterSafetyPass,
		maximumCombinedBoostDb,
		confidence,
		warnings,
		stopReason,
		regenerationCycles,
		optimizationPasses: 12,
		executionTimeMs,
		diagnostics,
	};
}

export * from "./types";
export * from "./constants";

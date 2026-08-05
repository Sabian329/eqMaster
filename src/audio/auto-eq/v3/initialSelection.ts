import {
	CANDIDATES_PER_ITERATION,
	GAIN_RETUNE_DELTAS_DB,
	GAIN_RETUNE_PASSES,
	MIN_FILTER_GAIN_DB,
} from "./constants";
import {
	buildCandidatePools,
	candidateToFilter,
	cloneFilter,
	resetCandidateCounter,
} from "./candidatePool";
import {
	acceptsCandidateEvaluation,
	evaluateCandidateAddition,
	overlapOctaves,
} from "./candidateEvaluation";
import { calculateTotalCost } from "./costFunction";
import { clampFilterGain } from "./frequencyLimits";
import {
	rejectSimilarCandidates,
	responseCorrelation,
} from "./filterSimilarity";
import { detectResonanceCandidates } from "./resonanceCandidates";
import { detectShelfCandidates } from "./shelfCandidates";
import { detectTonalCandidates } from "./tonalCandidates";
import { refreshPreparedResidual } from "./prepareMeasurement";
import type {
	AutoEqV3Options,
	AutoEqV3Progress,
	AutoEqV3StopReason,
	FilterCandidate,
	FrequencyPoint,
	GeneratedEqFilter,
	PreparedMeasurement,
} from "./types";

export type ProgressCallback = (progress: AutoEqV3Progress) => void;

function isResonanceReason(reason: GeneratedEqFilter["reason"]): boolean {
	return reason === "local-resonance" || reason === "repeated-resonance";
}

function isTonalOrShelf(reason: GeneratedEqFilter["reason"]): boolean {
	return (
		reason === "broad-tonal-error" ||
		reason === "low-frequency-tilt" ||
		reason === "high-frequency-tilt"
	);
}

export function getMinimumImprovementPercent(
	currentFilterCount: number,
): number {
	if (currentFilterCount < 4) return 0.04;
	if (currentFilterCount < 8) return 0.08;
	if (currentFilterCount < 12) return 0.15;
	return 0.25;
}

function retuneFilterGains(
	filters: GeneratedEqFilter[],
	prepared: PreparedMeasurement,
	measurements: FrequencyPoint[][],
	options: AutoEqV3Options,
): GeneratedEqFilter[] {
	let current = filters.map(cloneFilter);
	let bestCost = calculateTotalCost(
		prepared,
		measurements,
		current,
		options,
	).total;
	const limitOptions = { measurementCount: prepared.measurementCount };

	for (let pass = 0; pass < GAIN_RETUNE_PASSES; pass += 1) {
		let improved = false;
		for (let index = 0; index < current.length; index += 1) {
			for (const delta of GAIN_RETUNE_DELTAS_DB) {
				const trial = current.map(cloneFilter);
				const proposed = trial[index].gainDb + delta;
				// Above 1 kHz keep shallow tonal cuts inside the intended gain bands.
				if (trial[index].frequency >= 1_000 && trial[index].gainDb < 0) {
					const strong = Boolean(trial[index].qualifiesForStrongBroadCut);
					const floor =
						trial[index].frequency < 5_000
							? strong
								? -4.0
								: -2.5
							: strong
								? -3.5
								: -3.0;
					if (proposed < floor) continue;
				}
				trial[index].gainDb = clampFilterGain(
					proposed,
					trial[index].frequency,
					trial[index].type,
					limitOptions,
				);
				const trialCost = calculateTotalCost(
					prepared,
					measurements,
					trial,
					options,
				).total;
				if (trialCost < bestCost) {
					bestCost = trialCost;
					current = trial;
					improved = true;
				}
			}
		}
		if (!improved) break;
	}

	return current;
}

function highFrequencyBand(
	frequency: number,
): "mid" | "high" | "other" {
	if (frequency >= 1_000 && frequency < 5_000) return "mid";
	if (frequency >= 5_000) return "high";
	return "other";
}

function tonalRegionAllowsCandidate(
	candidate: GeneratedEqFilter,
	existing: GeneratedEqFilter[],
	prepared: PreparedMeasurement,
	options: AutoEqV3Options,
): boolean {
	if (!isTonalOrShelf(candidate.reason)) return true;

	const candidateBand = highFrequencyBand(candidate.frequency);
	if (candidateBand !== "other") {
		const sameBandCount = existing.filter(
			(filter) =>
				isTonalOrShelf(filter.reason) &&
				highFrequencyBand(filter.frequency) === candidateBand,
		).length;
		// At most one mid-HF (≈1.5–3 kHz) and one high-HF (≥5 kHz) tonal/shelf.
		if (sameBandCount >= 1) return false;
	}

	const overlappingTonal = existing.filter((filter) => {
		if (!isTonalOrShelf(filter.reason)) return false;
		const distance = Math.abs(
			Math.log2(candidate.frequency / filter.frequency),
		);
		if (
			candidate.frequency >= 1_000 &&
			filter.frequency >= 1_000 &&
			distance < 0.75
		) {
			return true;
		}
		const correlation = responseCorrelation(
			candidate,
			filter,
			prepared.detailed,
			options.sampleRate,
		);
		const overlap = overlapOctaves(candidate, filter);
		return correlation > 0.85 && overlap > 0.5;
	});

	return overlappingTonal.length === 0;
}

function selectDiverseCandidates(
	pool: FilterCandidate[],
	count: number,
	existing: GeneratedEqFilter[],
	prepared: PreparedMeasurement,
	measurements: FrequencyPoint[][],
	options: AutoEqV3Options,
): FilterCandidate[] {
	const filtered = rejectSimilarCandidates(
		pool,
		existing,
		prepared.simGrid,
		options.sampleRate,
	);

	const baseCost = calculateTotalCost(
		prepared,
		measurements,
		existing,
		options,
	).total;

	// Cheap pre-score by global cost only; full local evaluation happens on accept.
	const scored = filtered
		.map((candidate) => {
			const trial = [...existing, candidateToFilter(candidate)];
			const trialCost = calculateTotalCost(
				prepared,
				measurements,
				trial,
				options,
			).total;
			return {
				candidate,
				improvement: baseCost - trialCost,
			};
		})
		.filter((entry) => entry.improvement > 0)
		.sort((left, right) => right.improvement - left.improvement);

	const selected: FilterCandidate[] = [];
	for (const { candidate } of scored) {
		if (selected.length >= count) break;
		const tooClose = selected.some(
			(existingCandidate) =>
				Math.abs(Math.log2(existingCandidate.frequency / candidate.frequency)) <
				1 / 24,
		);
		if (!tooClose) selected.push(candidate);
	}

	return selected;
}

function tryAddBestFromPool(
	filters: GeneratedEqFilter[],
	pool: FilterCandidate[],
	prepared: PreparedMeasurement,
	measurements: FrequencyPoint[][],
	options: AutoEqV3Options,
	rejectionStats: {
		rejectedOffBandDamageCount: number;
		rejectedOvercutCount: number;
		rejectedCandidateCount: number;
	},
): {
	filters: GeneratedEqFilter[];
	improved: boolean;
	improvementPercent: number;
} {
	const baseCost = calculateTotalCost(
		prepared,
		measurements,
		filters,
		options,
	).total;
	let bestFilters = filters;
	let bestCost = baseCost;
	let bestImprovement = 0;

	for (const candidate of pool) {
		if (Math.abs(candidate.gainDb) < MIN_FILTER_GAIN_DB) continue;

		const filter = candidateToFilter(candidate);
		if (!tonalRegionAllowsCandidate(filter, filters, prepared, options)) {
			rejectionStats.rejectedCandidateCount += 1;
			continue;
		}

		const evaluation = evaluateCandidateAddition(
			prepared,
			measurements,
			filters,
			filter,
			options,
		);

		if (
			!acceptsCandidateEvaluation(evaluation, {
				frequency: filter.frequency,
				reason: filter.reason,
				gainDb: filter.gainDb,
			})
		) {
			rejectionStats.rejectedCandidateCount += 1;
			const limitsFrequency = filter.frequency;
			if (
				evaluation.offBandDamage >
				(limitsFrequency < 1_000 ? 0.75 : 0.08)
			) {
				rejectionStats.rejectedOffBandDamageCount += 1;
			}
			if (
				evaluation.broadOvercutAfter >
				evaluation.broadOvercutBefore +
					(limitsFrequency < 1_000 ? 0.35 : 0.02)
			) {
				rejectionStats.rejectedOvercutCount += 1;
			}
			continue;
		}

		filter.localImprovement = evaluation.localImprovement;
		filter.offBandDamage = evaluation.offBandDamage;

		const nextFilters = [...filters, filter];
		const nextCost = evaluation.globalCostAfter;
		const improvement =
			((baseCost - nextCost) / Math.max(baseCost, 1e-6)) * 100;

		if (nextCost < bestCost) {
			bestCost = nextCost;
			bestFilters = nextFilters;
			bestImprovement = improvement;
		}
	}

	return {
		filters: bestFilters,
		improved: bestFilters.length > filters.length,
		improvementPercent: bestImprovement,
	};
}

function tryAddBestFromCategories(
	filters: GeneratedEqFilter[],
	resonancePool: FilterCandidate[],
	tonalPool: FilterCandidate[],
	shelfPool: FilterCandidate[],
	prepared: PreparedMeasurement,
	measurements: FrequencyPoint[][],
	options: AutoEqV3Options,
	rejectionStats: {
		rejectedOffBandDamageCount: number;
		rejectedOvercutCount: number;
		rejectedCandidateCount: number;
	},
): {
	filters: GeneratedEqFilter[];
	improved: boolean;
	improvementPercent: number;
} {
	const attempts = [
		tryAddBestFromPool(
			filters,
			resonancePool,
			prepared,
			measurements,
			options,
			rejectionStats,
		),
		tryAddBestFromPool(
			filters,
			tonalPool,
			prepared,
			measurements,
			options,
			rejectionStats,
		),
		tryAddBestFromPool(
			filters,
			shelfPool,
			prepared,
			measurements,
			options,
			rejectionStats,
		),
	];

	const improvedAttempts = attempts.filter((attempt) => attempt.improved);
	if (improvedAttempts.length === 0) {
		return attempts[0];
	}

	const bestOverall = improvedAttempts.reduce((best, attempt) =>
		attempt.improvementPercent > best.improvementPercent ? attempt : best,
	);

	const resonanceCount = filters.filter((filter) =>
		isResonanceReason(filter.reason),
	).length;
	const bestResonance = attempts[0];

	if (
		filters.length < 6 &&
		bestResonance.improved &&
		bestResonance.improvementPercent > 0 &&
		(resonanceCount === 0 ||
			bestResonance.improvementPercent >= bestOverall.improvementPercent * 0.65)
	) {
		return bestResonance;
	}

	return bestOverall;
}

export interface InitialSelectionResult {
	filters: GeneratedEqFilter[];
	stopReason: AutoEqV3StopReason;
	rejectedOffBandDamageCount: number;
	rejectedOvercutCount: number;
	rejectedCandidateCount: number;
}

export function initialFilterSelection(
	prepared: PreparedMeasurement,
	measurements: FrequencyPoint[][],
	options: AutoEqV3Options,
	onProgress?: ProgressCallback,
	startingFilters: GeneratedEqFilter[] = [],
): InitialSelectionResult {
	if (startingFilters.length === 0) {
		resetCandidateCounter();
	}

	let filters: GeneratedEqFilter[] = startingFilters.map(cloneFilter);
	let baseCost = calculateTotalCost(
		prepared,
		measurements,
		filters,
		options,
	).total;
	let stopReason: AutoEqV3StopReason = "completed";
	let cutsOnlyPhase = true;
	const rejectionStats = {
		rejectedOffBandDamageCount: 0,
		rejectedOvercutCount: 0,
		rejectedCandidateCount: 0,
	};

	for (let iteration = 0; iteration < options.maxFilters; iteration += 1) {
		onProgress?.({
			stage: "selecting-filters",
			progress: 0.2 + (iteration / options.maxFilters) * 0.35,
			filterCount: filters.length,
			currentCost: baseCost,
			iteration,
		});

		const workingPrepared = refreshPreparedResidual(prepared, filters, options);

		const resonances = detectResonanceCandidates(workingPrepared);
		const tonalSegments = detectTonalCandidates(workingPrepared);
		const shelves = detectShelfCandidates(workingPrepared);
		const pools = buildCandidatePools(
			workingPrepared,
			options,
			resonances,
			tonalSegments,
			shelves,
		);

		const minImprovement = getMinimumImprovementPercent(filters.length);

		const resonancePool = selectDiverseCandidates(
			pools.resonance.filter(
				(candidate) => !cutsOnlyPhase || candidate.gainDb < 0,
			),
			CANDIDATES_PER_ITERATION.resonance,
			filters,
			workingPrepared,
			measurements,
			options,
		);
		const tonalPool = selectDiverseCandidates(
			pools.tonal.filter((candidate) => !cutsOnlyPhase || candidate.gainDb < 0),
			CANDIDATES_PER_ITERATION.tonal,
			filters,
			workingPrepared,
			measurements,
			options,
		);
		const shelfPool = selectDiverseCandidates(
			pools.shelf.filter((candidate) => !cutsOnlyPhase || candidate.gainDb < 0),
			CANDIDATES_PER_ITERATION.shelf,
			filters,
			workingPrepared,
			measurements,
			options,
		);

		const activePool = [...resonancePool, ...tonalPool, ...shelfPool];

		if (activePool.length === 0) {
			if (cutsOnlyPhase) {
				cutsOnlyPhase = false;
				iteration -= 1;
				continue;
			}
			stopReason = "no-improvement";
			break;
		}

		const result = tryAddBestFromCategories(
			filters,
			resonancePool,
			tonalPool,
			shelfPool,
			workingPrepared,
			measurements,
			options,
			rejectionStats,
		);

		if (!result.improved) {
			if (cutsOnlyPhase) {
				cutsOnlyPhase = false;
				iteration -= 1;
				continue;
			}
			stopReason = "no-improvement";
			break;
		}

		if (result.improvementPercent < minImprovement) {
			if (cutsOnlyPhase) {
				cutsOnlyPhase = false;
				iteration -= 1;
				continue;
			}
			stopReason = "minimum-improvement-not-met";
			break;
		}

		filters = retuneFilterGains(
			result.filters,
			prepared,
			measurements,
			options,
		);
		const nextCost = calculateTotalCost(
			prepared,
			measurements,
			filters,
			options,
		).total;

		const latest = filters[filters.length - 1];
		if (!latest || Math.abs(latest.gainDb) < MIN_FILTER_GAIN_DB) {
			filters.pop();
			stopReason = "minimum-improvement-not-met";
			break;
		}

		latest.improvementPercent = result.improvementPercent;
		const improvement =
			((baseCost - nextCost) / Math.max(baseCost, 1e-6)) * 100;
		if (improvement < minImprovement) {
			stopReason = "minimum-improvement-not-met";
			break;
		}

		baseCost = nextCost;
	}

	if (filters.length >= options.maxFilters) {
		stopReason = "max-filters-reached";
	}

	return {
		filters,
		stopReason,
		rejectedOffBandDamageCount: rejectionStats.rejectedOffBandDamageCount,
		rejectedOvercutCount: rejectionStats.rejectedOvercutCount,
		rejectedCandidateCount: rejectionStats.rejectedCandidateCount,
	};
}

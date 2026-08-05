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
import { calculateTotalCost } from "./costFunction";
import { clampFilterGain } from "./frequencyLimits";
import { rejectSimilarCandidates } from "./filterSimilarity";
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

	for (let pass = 0; pass < GAIN_RETUNE_PASSES; pass += 1) {
		let improved = false;
		for (let index = 0; index < current.length; index += 1) {
			for (const delta of GAIN_RETUNE_DELTAS_DB) {
				const trial = current.map(cloneFilter);
				trial[index].gainDb = clampFilterGain(
					trial[index].gainDb + delta,
					trial[index].frequency,
					trial[index].type,
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

	const scored = filtered
		.map((candidate) => {
			const trial = [...existing, candidateToFilter(candidate)];
			const trialCost = calculateTotalCost(
				prepared,
				measurements,
				trial,
				options,
			).total;
			const improvement = (baseCost - trialCost) / Math.max(baseCost, 1e-6);
			return { candidate, improvement };
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

		const nextFilters = [...filters, candidateToFilter(candidate)];
		const nextCost = calculateTotalCost(
			prepared,
			measurements,
			nextFilters,
			options,
		).total;
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
): {
	filters: GeneratedEqFilter[];
	improved: boolean;
	improvementPercent: number;
} {
	const attempts = [
		tryAddBestFromPool(filters, resonancePool, prepared, measurements, options),
		tryAddBestFromPool(filters, tonalPool, prepared, measurements, options),
		tryAddBestFromPool(filters, shelfPool, prepared, measurements, options),
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

	return { filters, stopReason };
}

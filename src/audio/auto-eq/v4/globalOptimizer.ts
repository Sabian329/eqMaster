import {
	getV4SearchBudget,
	MIN_FILTER_GAIN_DB,
	OPTIMIZATION_STAGES,
} from "./constants";
import { cloneV4Filter } from "./candidateGeneration";
import { getV4CorrectionStrength } from "./correctionStrength";
import { clampFilterGain, clampFilterQ } from "./frequencyLimits";
import { calculateV4TotalCost } from "./multiScaleCost";
import { buildV4MultiStartVariants } from "./multiStart";
import { clampFilterFrequency } from "./prepareMeasurement";
import type {
	AutoEqV4Options,
	AutoEqV4Progress,
	PreparedV4Measurement,
	V4GeneratedFilter,
} from "./types";

export type V4ProgressCallback = (progress: AutoEqV4Progress) => void;

function limitGainIncrease(
	original: V4GeneratedFilter,
	proposedGainDb: number,
	prepared: PreparedV4Measurement,
): number {
	const strength = getV4CorrectionStrength(
		original.frequency,
		prepared.measurementCount,
		original.confidence,
	);
	const maxMagnitude = Math.abs(original.gainDb) / Math.max(strength, 0.25);

	if (original.gainDb < 0) {
		const floor = -Math.max(Math.abs(original.gainDb), maxMagnitude * strength);
		return Math.max(proposedGainDb, floor * 1.15);
	}

	const ceiling = Math.max(original.gainDb, maxMagnitude * strength);
	return Math.min(proposedGainDb, ceiling * 1.15);
}

function coordinateDescentPass(
	filters: V4GeneratedFilter[],
	prepared: PreparedV4Measurement,
	options: AutoEqV4Options,
	frequencyStep: number,
	gainStep: number,
	qMultiplier: number,
): V4GeneratedFilter[] {
	let current = filters.map(cloneV4Filter);
	let bestCost = calculateV4TotalCost(prepared, current, options).total;
	const limitOptions = { measurementCount: prepared.measurementCount };

	for (let index = 0; index < current.length; index += 1) {
		const original = cloneV4Filter(current[index]);
		const trials: V4GeneratedFilter[][] = [];

		for (const frequency of [
			original.frequency * 2 ** frequencyStep,
			original.frequency / 2 ** frequencyStep,
		]) {
			const trial = current.map(cloneV4Filter);
			const clampedFrequency = clampFilterFrequency(frequency, trial[index].type, trial[index].reason, options);
			trial[index].frequency = clampedFrequency;
			trial[index].gainDb = clampFilterGain(trial[index].gainDb, clampedFrequency, trial[index].type, limitOptions);
			trial[index].q = clampFilterQ(
				trial[index].q,
				clampedFrequency,
				trial[index].gainDb,
				trial[index].type,
				false,
				limitOptions,
			);
			trials.push(trial);
		}

		for (const gainDb of [original.gainDb + gainStep, original.gainDb - gainStep]) {
			const trial = current.map(cloneV4Filter);
			const limitedGain = limitGainIncrease(original, gainDb, prepared);
			trial[index].gainDb = clampFilterGain(limitedGain, trial[index].frequency, trial[index].type, limitOptions);
			trials.push(trial);
		}

		for (const q of [original.q * qMultiplier, original.q / qMultiplier]) {
			const trial = current.map(cloneV4Filter);
			trial[index].q = clampFilterQ(q, trial[index].frequency, trial[index].gainDb, trial[index].type, false, limitOptions);
			trials.push(trial);
		}

		trials.push(current.filter((_, filterIndex) => filterIndex !== index));

		for (const trial of trials) {
			const trialCost = calculateV4TotalCost(prepared, trial, options).total;
			if (trialCost < bestCost) {
				bestCost = trialCost;
				current = trial;
			}
		}
	}

	return current;
}

function optimizeSingleStart(
	initialFilters: V4GeneratedFilter[],
	prepared: PreparedV4Measurement,
	options: AutoEqV4Options,
	onProgress?: V4ProgressCallback,
	startIndex = 0,
	startCount = 1,
): { filters: V4GeneratedFilter[]; cost: number } {
	const budget = getV4SearchBudget(options.precisionMode);
	let current = initialFilters.filter((filter) => Math.abs(filter.gainDb) >= MIN_FILTER_GAIN_DB);
	let bestFilters = current.map(cloneV4Filter);
	let bestCost = calculateV4TotalCost(prepared, bestFilters, options).total;

	for (let pass = 0; pass < budget.maxOptimizerPasses; pass += 1) {
		onProgress?.({
			stage: "global-optimization",
			progress:
				0.6 +
				(startIndex / startCount) * 0.2 +
				(pass / (startCount * budget.maxOptimizerPasses)) * 0.2,
			filterCount: current.length,
			currentFilterCount: current.length,
			currentCost: bestCost,
			iteration: pass,
			optimizationPass: pass,
		});

		const beforeCost = calculateV4TotalCost(prepared, current, options).total;
		let improved = false;

		for (let stage = 0; stage < budget.optimizationStageCount; stage += 1) {
			const next = coordinateDescentPass(
				current,
				prepared,
				options,
				OPTIMIZATION_STAGES.frequencyStepsOctaves[stage],
				OPTIMIZATION_STAGES.gainStepsDb[stage] ?? 0.1,
				OPTIMIZATION_STAGES.qMultipliersPerStage[stage] ?? 1.02,
			);
			const nextCost = calculateV4TotalCost(prepared, next, options).total;
			if (nextCost < beforeCost - 1e-6) {
				current = next;
				improved = true;
			}
		}

		const currentCost = calculateV4TotalCost(prepared, current, options).total;
		if (currentCost < bestCost) {
			bestCost = currentCost;
			bestFilters = current.map(cloneV4Filter);
		}

		if (!improved) break;
	}

	return { filters: bestFilters, cost: bestCost };
}

/**
 * Runs coordinate-descent optimization on MULTI_START_COUNT deterministic
 * variants of `initialFilters` and returns the lowest-cost outcome.
 */
export function optimizeV4Filters(
	initialFilters: V4GeneratedFilter[],
	prepared: PreparedV4Measurement,
	options: AutoEqV4Options,
	onProgress?: V4ProgressCallback,
): V4GeneratedFilter[] {
	const starts = buildV4MultiStartVariants(
		initialFilters,
		options.seed,
		prepared,
		options.precisionMode,
	);

	let bestFilters = initialFilters.map(cloneV4Filter);
	let bestCost = calculateV4TotalCost(prepared, bestFilters, options).total;

	for (let startIndex = 0; startIndex < starts.length; startIndex += 1) {
		const result = optimizeSingleStart(starts[startIndex], prepared, options, onProgress, startIndex, starts.length);
		if (result.cost < bestCost) {
			bestCost = result.cost;
			bestFilters = result.filters;
		}
	}

	return bestFilters;
}

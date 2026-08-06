import { MERGE_CORRELATION_THRESHOLD, MERGE_DISTANCE_OCTAVES } from "./constants";
import { getCombinedFilterResponseDb } from "./biquadResponse";
import { cloneV4Filter, createV4FilterId } from "./candidateGeneration";
import { clampFilterGain, clampFilterQ } from "./frequencyLimits";
import { calculateV4TotalCost } from "./multiScaleCost";
import type { AutoEqV4Options, FrequencyPoint, PreparedV4Measurement, V4GeneratedFilter } from "./types";

export function distanceOctaves(leftFrequency: number, rightFrequency: number): number {
	return Math.abs(Math.log2(leftFrequency / rightFrequency));
}

export function responseCorrelation(
	left: V4GeneratedFilter,
	right: V4GeneratedFilter,
	grid: FrequencyPoint[],
	sampleRate: number,
): number {
	const leftResponse = grid.map((point) => getCombinedFilterResponseDb([left], point.frequency, sampleRate));
	const rightResponse = grid.map((point) => getCombinedFilterResponseDb([right], point.frequency, sampleRate));

	const leftMean = leftResponse.reduce((sum, value) => sum + value, 0) / leftResponse.length;
	const rightMean = rightResponse.reduce((sum, value) => sum + value, 0) / rightResponse.length;

	let numerator = 0;
	let leftDenominator = 0;
	let rightDenominator = 0;
	for (let index = 0; index < leftResponse.length; index += 1) {
		const leftDelta = leftResponse[index] - leftMean;
		const rightDelta = rightResponse[index] - rightMean;
		numerator += leftDelta * rightDelta;
		leftDenominator += leftDelta * leftDelta;
		rightDenominator += rightDelta * rightDelta;
	}

	const denominator = Math.sqrt(leftDenominator * rightDenominator);
	return denominator > 0 ? numerator / denominator : 0;
}

function tryMergeFilters(left: V4GeneratedFilter, right: V4GeneratedFilter): V4GeneratedFilter {
	return {
		id: createV4FilterId(),
		type: left.type === right.type ? left.type : "PK",
		frequency: Math.sqrt(left.frequency * right.frequency),
		gainDb: (left.gainDb + right.gainDb) * 0.55,
		q: Math.max(left.q, right.q) * 0.85,
		enabled: true,
		confidence: Math.max(left.confidence, right.confidence),
		improvementPercent: Math.max(left.improvementPercent, right.improvementPercent),
		contributionPercent: Math.max(left.contributionPercent, right.contributionPercent),
		affectedRange: {
			fromHz: Math.min(left.affectedRange.fromHz, right.affectedRange.fromHz),
			toHz: Math.max(left.affectedRange.toHz, right.affectedRange.toHz),
		},
		reason: left.reason,
	};
}

function retuneMergedFilter(
	filters: V4GeneratedFilter[],
	mergedIndex: number,
	prepared: PreparedV4Measurement,
	options: AutoEqV4Options,
): V4GeneratedFilter[] {
	let current = filters.map(cloneV4Filter);
	let bestCost = calculateV4TotalCost(prepared, current, options).total;
	const limitOptions = { measurementCount: prepared.measurementCount };

	const deltas = [
		{ frequencyFactor: 2 ** (1 / 48), gainDelta: 0, qFactor: 1 },
		{ frequencyFactor: 2 ** (-1 / 48), gainDelta: 0, qFactor: 1 },
		{ frequencyFactor: 1, gainDelta: 0.25, qFactor: 1 },
		{ frequencyFactor: 1, gainDelta: -0.25, qFactor: 1 },
		{ frequencyFactor: 1, gainDelta: 0, qFactor: 1.1 },
		{ frequencyFactor: 1, gainDelta: 0, qFactor: 1 / 1.1 },
	];

	for (const delta of deltas) {
		const trial = current.map(cloneV4Filter);
		const filter = trial[mergedIndex];
		filter.frequency *= delta.frequencyFactor;
		filter.gainDb = clampFilterGain(filter.gainDb + delta.gainDelta, filter.frequency, filter.type, limitOptions);
		filter.q = clampFilterQ(filter.q * delta.qFactor, filter.frequency, filter.gainDb, filter.type, false, limitOptions);
		const trialCost = calculateV4TotalCost(prepared, trial, options).total;
		if (trialCost < bestCost) {
			bestCost = trialCost;
			current = trial;
		}
	}

	return current;
}

function qualifiesForMerge(
	left: V4GeneratedFilter,
	right: V4GeneratedFilter,
	prepared: PreparedV4Measurement,
	options: AutoEqV4Options,
): boolean {
	if (Math.sign(left.gainDb) !== Math.sign(right.gainDb)) return false;

	const compatibleType =
		left.type === right.type || left.type === "PK" || right.type === "PK";
	if (!compatibleType) return false;

	const distance = distanceOctaves(left.frequency, right.frequency);
	const correlation = responseCorrelation(left, right, prepared.grid, options.sampleRate);

	return distance < MERGE_DISTANCE_OCTAVES && correlation >= MERGE_CORRELATION_THRESHOLD;
}

/** Merges near-duplicate filters (same sign, close frequency, highly correlated response) into one. */
export function mergeV4Filters(
	filters: V4GeneratedFilter[],
	prepared: PreparedV4Measurement,
	options: AutoEqV4Options,
): V4GeneratedFilter[] {
	let current = filters.map(cloneV4Filter).sort((a, b) => a.frequency - b.frequency);
	let merged = true;

	while (merged) {
		merged = false;
		for (let left = 0; left < current.length; left += 1) {
			for (let right = left + 1; right < current.length; right += 1) {
				if (!qualifiesForMerge(current[left], current[right], prepared, options)) continue;

				const mergedFilter = tryMergeFilters(current[left], current[right]);
				const limitOptions = { measurementCount: prepared.measurementCount };
				mergedFilter.gainDb = clampFilterGain(mergedFilter.gainDb, mergedFilter.frequency, mergedFilter.type, limitOptions);
				mergedFilter.q = clampFilterQ(mergedFilter.q, mergedFilter.frequency, mergedFilter.gainDb, mergedFilter.type, false, limitOptions);

				const withMerged = current.filter((_, index) => index !== left && index !== right);
				withMerged.push(mergedFilter);

				const originalCost = calculateV4TotalCost(prepared, current, options).total;
				let candidate = withMerged;
				candidate = retuneMergedFilter(candidate, candidate.length - 1, prepared, options);
				const mergedCost = calculateV4TotalCost(prepared, candidate, options).total;

				if (mergedCost <= originalCost * 1.0015) {
					current = candidate.sort((a, b) => a.frequency - b.frequency);
					merged = true;
					break;
				}
			}
			if (merged) break;
		}
	}

	return current.slice(0, options.maxFilters);
}

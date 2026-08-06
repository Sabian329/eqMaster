import {
	MERGE_CORRELATION_THRESHOLD,
	MERGE_DISTANCE_OCTAVES,
} from "./constants";
import { calculateTotalCost, computePredictedCurve } from "./costFunction";
import { clampFilterGain, clampFilterQ } from "./frequencyLimits";
import { cloneFilter, createFilterId } from "./candidatePool";
import { distanceOctaves, responseCorrelation } from "./filterSimilarity";
import {
	computeBroadOvercutPenalty,
	smoothToBroad,
} from "./overcut";
import type {
	AutoEqV3Options,
	FrequencyPoint,
	GeneratedEqFilter,
	PreparedMeasurement,
} from "./types";

function tryMergeFilters(
	left: GeneratedEqFilter,
	right: GeneratedEqFilter,
): GeneratedEqFilter {
	const mergedFrequency = Math.sqrt(left.frequency * right.frequency);
	const mergedGain = (left.gainDb + right.gainDb) * 0.55;
	const mergedQ = Math.max(left.q, right.q) * 0.85;

	return {
		id: createFilterId(),
		type: left.type === right.type ? left.type : "PK",
		frequency: mergedFrequency,
		gainDb: mergedGain,
		q: mergedQ,
		enabled: true,
		confidence: Math.max(left.confidence, right.confidence),
		improvementPercent: Math.max(
			left.improvementPercent,
			right.improvementPercent,
		),
		contributionPercent: Math.max(
			left.contributionPercent,
			right.contributionPercent,
		),
		affectedRange: {
			fromHz: Math.min(left.affectedRange.fromHz, right.affectedRange.fromHz),
			toHz: Math.max(left.affectedRange.toHz, right.affectedRange.toHz),
		},
		reason: left.reason,
	};
}

function retuneMergedFilter(
	filters: GeneratedEqFilter[],
	mergedIndex: number,
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

	const deltas = [
		{ frequencyFactor: 2 ** (1 / 48), gainDelta: 0, qFactor: 1 },
		{ frequencyFactor: 2 ** (-1 / 48), gainDelta: 0, qFactor: 1 },
		{ frequencyFactor: 1, gainDelta: 0.25, qFactor: 1 },
		{ frequencyFactor: 1, gainDelta: -0.25, qFactor: 1 },
		{ frequencyFactor: 1, gainDelta: 0, qFactor: 1.1 },
		{ frequencyFactor: 1, gainDelta: 0, qFactor: 1 / 1.1 },
	];

	for (const delta of deltas) {
		const trial = current.map(cloneFilter);
		const filter = trial[mergedIndex];
		filter.frequency *= delta.frequencyFactor;
		filter.gainDb = clampFilterGain(
			filter.gainDb + delta.gainDelta,
			filter.frequency,
			filter.type,
			{ measurementCount: prepared.measurementCount },
		);
		filter.q = clampFilterQ(
			filter.q * delta.qFactor,
			filter.frequency,
			filter.gainDb,
			filter.type,
			false,
			{ measurementCount: prepared.measurementCount },
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
		}
	}

	return current;
}

function qualifiesForMerge(
	left: GeneratedEqFilter,
	right: GeneratedEqFilter,
	prepared: PreparedMeasurement,
	options: AutoEqV3Options,
): boolean {
	if (Math.sign(left.gainDb) !== Math.sign(right.gainDb)) return false;

	const compatibleType =
		left.type === right.type ||
		(left.type === "PK" && right.type !== "PK") ||
		(right.type === "PK" && left.type !== "PK");
	if (!compatibleType) return false;

	const distance = distanceOctaves(left.frequency, right.frequency);
	const correlation = responseCorrelation(
		left,
		right,
		prepared.detailed,
		options.sampleRate,
	);

	const leftIsLocal =
		left.reason === "local-resonance" || left.reason === "repeated-resonance";
	const rightIsLocal =
		right.reason === "local-resonance" || right.reason === "repeated-resonance";

	if (leftIsLocal && rightIsLocal && distance < MERGE_DISTANCE_OCTAVES) {
		return correlation >= MERGE_CORRELATION_THRESHOLD;
	}

	const leftIsTonal =
		left.reason === "broad-tonal-error" ||
		left.reason === "low-frequency-tilt" ||
		left.reason === "high-frequency-tilt";
	const rightIsTonal =
		right.reason === "broad-tonal-error" ||
		right.reason === "low-frequency-tilt" ||
		right.reason === "high-frequency-tilt";

	if (leftIsTonal && rightIsTonal) {
		return correlation > 0.9;
	}

	return distance < MERGE_DISTANCE_OCTAVES && correlation >= MERGE_CORRELATION_THRESHOLD;
}

export function mergeSimilarFilters(
	filters: GeneratedEqFilter[],
	prepared: PreparedMeasurement,
	measurements: FrequencyPoint[][],
	options: AutoEqV3Options,
): GeneratedEqFilter[] {
	let current = filters
		.map(cloneFilter)
		.sort((a, b) => a.frequency - b.frequency);
	let merged = true;

	while (merged) {
		merged = false;
		for (let left = 0; left < current.length; left += 1) {
			for (let right = left + 1; right < current.length; right += 1) {
				if (
					!qualifiesForMerge(
						current[left],
						current[right],
						prepared,
						options,
					)
				) {
					continue;
				}

				const mergedFilter = tryMergeFilters(current[left], current[right]);
				mergedFilter.gainDb = clampFilterGain(
					mergedFilter.gainDb,
					mergedFilter.frequency,
					mergedFilter.type,
					{ measurementCount: prepared.measurementCount },
				);
				mergedFilter.q = clampFilterQ(
					mergedFilter.q,
					mergedFilter.frequency,
					mergedFilter.gainDb,
					mergedFilter.type,
					false,
					{ measurementCount: prepared.measurementCount },
				);

				const withMerged = current.filter(
					(_, index) => index !== left && index !== right,
				);
				withMerged.push(mergedFilter);

				const originalCost = calculateTotalCost(
					prepared,
					measurements,
					current,
					options,
				).total;
				const originalPredicted = computePredictedCurve(
					prepared,
					current,
					options,
				);
				const originalOvercut = computeBroadOvercutPenalty(
					smoothToBroad(originalPredicted),
					prepared.target,
				);

				let candidate = withMerged;
				const mergedIndex = candidate.length - 1;
				candidate = retuneMergedFilter(
					candidate,
					mergedIndex,
					prepared,
					measurements,
					options,
				);

				const mergedCost = calculateTotalCost(
					prepared,
					measurements,
					candidate,
					options,
				).total;
				const mergedPredicted = computePredictedCurve(
					prepared,
					candidate,
					options,
				);
				const mergedOvercut = computeBroadOvercutPenalty(
					smoothToBroad(mergedPredicted),
					prepared.target,
				);

				if (
					mergedCost <= originalCost * 1.0015 &&
					mergedOvercut <= originalOvercut
				) {
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

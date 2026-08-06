import {
	BOOST_PENALTY_COEFFICIENT,
	CANCELLATION_DISTANCE_OCTAVES,
	COST_ERROR_CLAMP_DB,
	HUBER_DELTA,
	OVERLAP_DISTANCE_OCTAVES,
} from "./constants";
import { getCombinedFilterResponseDb } from "./biquadResponse";
import { buildAnalysisPoint, getCorrectabilityWeight } from "./correctability";
import { getHighQPenaltyWeight, getPreferredMaximumQ } from "./correctionStrength";
import { clamp, frequencyWeight, huber } from "./math";
import { smoothFractionalOctave } from "./smoothing";
import type {
	AutoEqV4Options,
	FrequencyPoint,
	PreparedV4Measurement,
	V4CostBreakdown,
	V4GeneratedFilter,
} from "./types";

export function getOvercutPenaltyMultiplier(frequency: number): number {
	if (frequency < 200) return 1.0;
	if (frequency < 1_000) return 1.5;
	if (frequency < 5_000) return 3.0;
	if (frequency < 10_000) return 3.5;
	return 2.5;
}

/** Frequency-dependent multi-scale cost weights (1/24 local, coarser scales as regularization). */
export function getScaleWeights(frequency: number): {
	octave1_24: number;
	octave1_12: number;
	octave1_6: number;
	octave1_3: number;
} {
	if (frequency < 200) {
		return {
			octave1_24: 0.6,
			octave1_12: 0.25,
			octave1_6: 0.1,
			octave1_3: 0.05,
		};
	}
	if (frequency < 1_000) {
		return {
			octave1_24: 0.45,
			octave1_12: 0.3,
			octave1_6: 0.15,
			octave1_3: 0.1,
		};
	}
	if (frequency < 5_000) {
		return {
			octave1_24: 0.2,
			octave1_12: 0.35,
			octave1_6: 0.25,
			octave1_3: 0.2,
		};
	}
	return {
		octave1_24: 0.1,
		octave1_12: 0.25,
		octave1_6: 0.3,
		octave1_3: 0.35,
	};
}

export function getMaximumBroadCutDb(frequency: number): number {
	if (frequency < 200) return -15;
	if (frequency < 1_000) return -8;
	if (frequency < 5_000) return -5.0;
	if (frequency < 10_000) return -4.0;
	return -3.0;
}

/** Safety pass reacts only after the broad (1/3) predicted curve falls below target by more than this. */
export function getAllowedBroadUndershootDb(frequency: number): number {
	if (frequency < 1_000) return 1.5;
	if (frequency < 5_000) return 2.0;
	if (frequency < 10_000) return 2.25;
	return 2.5;
}

export function getTargetToleranceDb(frequency: number): number {
	if (frequency < 200) return 0.75;
	if (frequency < 1_000) return 1.0;
	if (frequency < 5_000) return 1.5;
	if (frequency < 10_000) return 1.75;
	return 2.25;
}

export function applyTolerance(errorDb: number, toleranceDb: number): number {
	const magnitude = Math.abs(errorDb);
	if (magnitude <= toleranceDb) return 0;
	return Math.sign(errorDb) * (magnitude - toleranceDb);
}

function asymmetricError(errorDb: number, frequency: number): number {
	if (frequency < 1_000) return errorDb;
	if (errorDb < 0) return errorDb * 1.35;
	return errorDb * 0.85;
}

export function computeCombinedFilterResponse(
	filters: V4GeneratedFilter[],
	grid: FrequencyPoint[],
	sampleRate: number,
): FrequencyPoint[] {
	return grid.map((point) => ({
		frequency: point.frequency,
		db: getCombinedFilterResponseDb(filters, point.frequency, sampleRate),
	}));
}

export function computePredictedCurve(
	curve: FrequencyPoint[],
	filterResponse: number[],
): FrequencyPoint[] {
	return curve.map((point, index) => ({
		frequency: point.frequency,
		db: point.db + filterResponse[index],
	}));
}

function pointHuberCost(
	measuredDb: number,
	filterResponseDb: number,
	targetDb: number,
	frequency: number,
	prepared: PreparedV4Measurement,
	index: number,
	options: AutoEqV4Options,
): { loss: number; weight: number } {
	const predictedDb = measuredDb + filterResponseDb;
	const rawError = predictedDb - targetDb;
	const limitedError = clamp(rawError, -COST_ERROR_CLAMP_DB, COST_ERROR_CLAMP_DB);
	const toleratedError = applyTolerance(limitedError, getTargetToleranceDb(frequency));
	const shapedError = asymmetricError(toleratedError, frequency);

	const analysis = buildAnalysisPoint({
		frequency,
		errorDb: rawError,
		reliability: prepared.reliability[index],
		boostAllowed:
			options.allowBoosts &&
			frequency >= prepared.usableBoostRange.fromHz &&
			frequency <= prepared.usableBoostRange.toHz,
		usableFromHz: prepared.usableBoostRange.fromHz,
		usableToHz: prepared.usableBoostRange.toHz,
		isCombArtifact: prepared.analysisPoints[index]?.isCombArtifact,
	});
	const correctabilityWeight = getCorrectabilityWeight(analysis);
	const weight = frequencyWeight(frequency) * prepared.reliability[index] * correctabilityWeight;
	return { loss: huber(shapedError, HUBER_DELTA) * weight, weight };
}

function multiScaleHuberCost(
	prepared: PreparedV4Measurement,
	filterResponse: number[],
	options: AutoEqV4Options,
): number {
	let totalLoss = 0;
	let totalWeight = 0;

	for (let index = 0; index < prepared.grid.length; index += 1) {
		const frequency = prepared.grid[index].frequency;
		if (frequency < options.minFrequency || frequency > options.maxFrequency) continue;

		const weights = getScaleWeights(frequency);
		const native = pointHuberCost(
			prepared.native1_24[index].db,
			filterResponse[index],
			prepared.target[index].db,
			frequency,
			prepared,
			index,
			options,
		);
		const fine = pointHuberCost(
			prepared.octave1_12[index].db,
			filterResponse[index],
			prepared.target[index].db,
			frequency,
			prepared,
			index,
			options,
		);
		const mid = pointHuberCost(
			prepared.octave1_6[index].db,
			filterResponse[index],
			prepared.target[index].db,
			frequency,
			prepared,
			index,
			options,
		);
		const broad = pointHuberCost(
			prepared.octave1_3[index].db,
			filterResponse[index],
			prepared.target[index].db,
			frequency,
			prepared,
			index,
			options,
		);

		const blendedLoss =
			weights.octave1_24 * native.loss +
			weights.octave1_12 * fine.loss +
			weights.octave1_6 * mid.loss +
			weights.octave1_3 * broad.loss;
		const blendedWeight =
			weights.octave1_24 * native.weight +
			weights.octave1_12 * fine.weight +
			weights.octave1_6 * mid.weight +
			weights.octave1_3 * broad.weight;

		totalLoss += blendedLoss;
		totalWeight += blendedWeight;
	}

	return totalLoss / Math.max(totalWeight, 1);
}

/** Overcut area in dB·octaves on the broad (1/3) scale. */
export function computeOvercutAreaDbOct(
	broadPredicted: FrequencyPoint[],
	target: FrequencyPoint[],
): { areaDbOct: number; maximumOvercutDb: number } {
	let area = 0;
	let maximumOvercutDb = 0;
	for (let index = 1; index < broadPredicted.length; index += 1) {
		const frequency = broadPredicted[index].frequency;
		const previousFrequency = broadPredicted[index - 1].frequency;
		const octaveWidth = Math.abs(Math.log2(frequency / previousFrequency));
		const overcutDb = Math.max(
			0,
			target[index].db - broadPredicted[index].db - getTargetToleranceDb(frequency),
		);
		area += overcutDb * octaveWidth;
		maximumOvercutDb = Math.max(maximumOvercutDb, overcutDb);
	}
	return { areaDbOct: area, maximumOvercutDb };
}

/** Excess (above-target) area in dB·octaves on a given scale. */
export function computeExcessAreaDbOct(
	predicted: FrequencyPoint[],
	target: FrequencyPoint[],
): number {
	let area = 0;
	for (let index = 1; index < predicted.length; index += 1) {
		const octaveWidth = Math.abs(
			Math.log2(predicted[index].frequency / predicted[index - 1].frequency),
		);
		const excessDb = Math.max(0, predicted[index].db - target[index].db);
		area += excessDb * octaveWidth;
	}
	return area;
}

function boostPenalty(filters: V4GeneratedFilter[], measurementCount: number): number {
	let penalty = 0;
	for (const filter of filters) {
		if (filter.gainDb <= 0) continue;
		let coefficient = BOOST_PENALTY_COEFFICIENT;
		if (measurementCount === 1 && filter.frequency >= 1_000) coefficient *= 1.5;
		penalty += coefficient * filter.gainDb * filter.gainDb;
	}
	return penalty;
}

function highQPenalty(filters: V4GeneratedFilter[], measurementCount: number): number {
	let penalty = 0;
	for (const filter of filters) {
		const preferred = getPreferredMaximumQ(filter.frequency);
		const excessiveQ = Math.max(0, filter.q - preferred);
		penalty += excessiveQ * excessiveQ * getHighQPenaltyWeight(filter.frequency, measurementCount);
	}
	return penalty;
}

function overlapPenalty(filters: V4GeneratedFilter[]): number {
	let penalty = 0;
	for (let left = 0; left < filters.length; left += 1) {
		for (let right = left + 1; right < filters.length; right += 1) {
			const distance = Math.abs(Math.log2(filters[left].frequency / filters[right].frequency));
			if (distance < OVERLAP_DISTANCE_OCTAVES) penalty += 0.08;
		}
	}
	return penalty;
}

function cancellationPenalty(filters: V4GeneratedFilter[]): number {
	let penalty = 0;
	for (let left = 0; left < filters.length; left += 1) {
		for (let right = left + 1; right < filters.length; right += 1) {
			const distance = Math.abs(Math.log2(filters[left].frequency / filters[right].frequency));
			if (distance >= CANCELLATION_DISTANCE_OCTAVES) continue;
			if (Math.sign(filters[left].gainDb) === Math.sign(filters[right].gainDb)) continue;
			penalty += 0.12;
		}
	}
	return penalty;
}

function headroomPenalty(filters: V4GeneratedFilter[], grid: FrequencyPoint[], sampleRate: number): number {
	let maxBoost = 0;
	for (const point of grid) {
		maxBoost = Math.max(maxBoost, getCombinedFilterResponseDb(filters, point.frequency, sampleRate));
	}
	return maxBoost > 6 ? 0.05 * (maxBoost - 6) ** 2 : 0;
}

function filterCountPenalty(filters: V4GeneratedFilter[], maxFilters: number): number {
	return 0.004 * (filters.length / Math.max(maxFilters, 1));
}

function offBandDamagePenalty(filters: V4GeneratedFilter[]): number {
	let penalty = 0;
	for (const filter of filters) {
		if (typeof filter.offBandDamage === "number" && filter.offBandDamage > 0) {
			penalty += filter.offBandDamage * 0.5;
		}
	}
	return penalty;
}

export function computeBroadOvercutPenalty(
	broadPredicted: FrequencyPoint[],
	target: FrequencyPoint[],
): number {
	let penalty = 0;
	for (let index = 0; index < broadPredicted.length; index += 1) {
		const frequency = broadPredicted[index].frequency;
		const toleranceDb =
			getTargetToleranceDb(frequency) +
			(frequency < 1_000 ? getAllowedBroadUndershootDb(frequency) * 0.5 : 0);
		const overcutDb = Math.max(0, target[index].db - broadPredicted[index].db - toleranceDb);
		penalty += frequencyWeight(frequency) * overcutDb * overcutDb * getOvercutPenaltyMultiplier(frequency);
	}
	return penalty / Math.max(broadPredicted.length, 1);
}

export function computeBroadCutLimitPenalty(broadFilterResponse: FrequencyPoint[]): number {
	let penalty = 0;
	for (const point of broadFilterResponse) {
		const maximumBroadCutDb = getMaximumBroadCutDb(point.frequency);
		const excessiveBroadCutDb = Math.max(0, maximumBroadCutDb - point.db);
		penalty += excessiveBroadCutDb * excessiveBroadCutDb * 2.5;
	}
	return penalty / Math.max(broadFilterResponse.length, 1);
}

export function calculateV4TotalCost(
	prepared: PreparedV4Measurement,
	filters: V4GeneratedFilter[],
	options: AutoEqV4Options,
): V4CostBreakdown {
	const grid = prepared.grid;
	const filterResponse = grid.map((point) =>
		getCombinedFilterResponseDb(filters, point.frequency, options.sampleRate),
	);

	const scaleCost = multiScaleHuberCost(prepared, filterResponse, options);

	const broadPredicted = computePredictedCurve(prepared.octave1_3, filterResponse);
	const overcutPenalty = computeBroadOvercutPenalty(broadPredicted, prepared.target);

	const smoothedFilterResponseCurve = smoothFractionalOctave(
		grid.map((point, index) => ({ frequency: point.frequency, db: filterResponse[index] })),
		3,
	);
	const broadCutLimitPenalty = computeBroadCutLimitPenalty(smoothedFilterResponseCurve);

	const boost = boostPenalty(filters, prepared.measurementCount);
	const highQ = highQPenalty(filters, prepared.measurementCount);
	const overlap = overlapPenalty(filters);
	const cancellation = cancellationPenalty(filters);
	const headroom = headroomPenalty(filters, grid, options.sampleRate);
	const filterCount = filterCountPenalty(filters, options.maxFilters);
	const offBand = offBandDamagePenalty(filters);

	const total =
		scaleCost +
		overcutPenalty +
		broadCutLimitPenalty +
		boost +
		highQ +
		overlap +
		cancellation +
		headroom +
		filterCount +
		offBand;

	return {
		total,
		scaleCost,
		overcutPenalty,
		broadCutLimitPenalty,
		boostPenalty: boost,
		highQPenalty: highQ,
		overlapPenalty: overlap,
		cancellationPenalty: cancellation,
		headroomPenalty: headroom,
		filterCountPenalty: filterCount,
		offBandDamagePenalty: offBand,
	};
}

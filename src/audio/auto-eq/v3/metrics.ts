import { COST_ERROR_CLAMP_DB, HUBER_DELTA } from "./constants";
import { getCombinedFilterResponseDb } from "./biquadResponse";
import { clamp, frequencyWeight, huber } from "./math";
import type {
	AutoEqV3Options,
	GeneratedEqFilter,
	PreparedMeasurement,
} from "./types";

export interface ErrorMetrics {
	rmsErrorDb: number;
	maximumErrorDb: number;
	scalarError: number;
	weightedRmsErrorDb: number;
}

export function computeErrorMetrics(
	prepared: PreparedMeasurement,
	filters: GeneratedEqFilter[],
	options: AutoEqV3Options,
): ErrorMetrics {
	const errors = prepared.detailed.map((point, index) => {
		const predicted =
			point.db +
			getCombinedFilterResponseDb(filters, point.frequency, options.sampleRate);
		return predicted - prepared.target[index].db;
	});

	const clamped = errors.map((error) =>
		clamp(error, -COST_ERROR_CLAMP_DB, COST_ERROR_CLAMP_DB),
	);
	const weights = prepared.detailed.map(
		(point, index) =>
			frequencyWeight(point.frequency) * prepared.reliability[index],
	);

	let weightedSum = 0;
	let weightTotal = 0;
	let weightedSquareSum = 0;

	for (let index = 0; index < clamped.length; index += 1) {
		weightedSum += huber(clamped[index], HUBER_DELTA) * weights[index];
		weightedSquareSum += clamped[index] * clamped[index] * weights[index];
		weightTotal += weights[index];
	}

	const scalarError = weightedSum / Math.max(weightTotal, 1);
	const weightedRmsErrorDb = Math.sqrt(
		weightedSquareSum / Math.max(weightTotal, 1),
	);
	const rmsErrorDb = Math.sqrt(
		clamped.reduce((sum, value) => sum + value * value, 0) /
			Math.max(clamped.length, 1),
	);
	const maximumErrorDb = Math.max(...clamped.map((value) => Math.abs(value)));

	return { rmsErrorDb, maximumErrorDb, scalarError, weightedRmsErrorDb };
}

export function computeBeforeMetrics(
	prepared: PreparedMeasurement,
	options: AutoEqV3Options,
): ErrorMetrics {
	return computeErrorMetrics(prepared, [], options);
}

export function computeAfterMetrics(
	prepared: PreparedMeasurement,
	filters: GeneratedEqFilter[],
	options: AutoEqV3Options,
): ErrorMetrics {
	return computeErrorMetrics(prepared, filters, options);
}

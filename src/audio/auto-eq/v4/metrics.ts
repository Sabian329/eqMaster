import { COST_ERROR_CLAMP_DB, HUBER_DELTA } from "./constants";
import { getCombinedFilterResponseDb } from "./biquadResponse";
import { clamp, frequencyWeight, huber } from "./math";
import {
	computeExcessAreaDbOct,
	computeOvercutAreaDbOct,
	computePredictedCurve,
	getTargetToleranceDb,
} from "./multiScaleCost";
import type {
	AutoEqV4Options,
	FrequencyPoint,
	PreparedV4Measurement,
	V4GeneratedFilter,
} from "./types";

export interface V4ErrorMetrics {
	rmsErrorDb: number;
	maximumErrorDb: number;
	scalarError: number;
	weightedRmsErrorDb: number;
	weightedRms1_24Db: number;
	weightedRms1_12Db: number;
	broadRmsDb: number;
	overcutAreaDbOct: number;
	excessAreaDbOct: number;
	maximumBroadOvercutDb: number;
}

function weightedRmsForCurve(
	curve: FrequencyPoint[],
	target: FrequencyPoint[],
	filterResponse: number[],
	reliability: Float64Array,
): number {
	let weightedSquareSum = 0;
	let weightTotal = 0;
	for (let index = 0; index < curve.length; index += 1) {
		const error = clamp(
			curve[index].db + filterResponse[index] - target[index].db,
			-COST_ERROR_CLAMP_DB,
			COST_ERROR_CLAMP_DB,
		);
		const weight = frequencyWeight(curve[index].frequency) * reliability[index];
		weightedSquareSum += error * error * weight;
		weightTotal += weight;
	}
	return Math.sqrt(weightedSquareSum / Math.max(weightTotal, 1));
}

/** Error metrics across fine (1/12), native (1/24) and broad (1/3) scales. */
export function computeV4ErrorMetrics(
	prepared: PreparedV4Measurement,
	filters: V4GeneratedFilter[],
	options: AutoEqV4Options,
): V4ErrorMetrics {
	const filterResponse = prepared.grid.map((point) =>
		getCombinedFilterResponseDb(filters, point.frequency, options.sampleRate),
	);

	const errors = prepared.octave1_12.map((point, index) => {
		return point.db + filterResponse[index] - prepared.target[index].db;
	});

	const clamped = errors.map((error) => clamp(error, -COST_ERROR_CLAMP_DB, COST_ERROR_CLAMP_DB));
	const weights = prepared.octave1_12.map(
		(point, index) => frequencyWeight(point.frequency) * prepared.reliability[index],
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
	const weightedRmsErrorDb = Math.sqrt(weightedSquareSum / Math.max(weightTotal, 1));
	const rmsErrorDb = Math.sqrt(
		clamped.reduce((sum, value) => sum + value * value, 0) / Math.max(clamped.length, 1),
	);
	const maximumErrorDb = Math.max(...clamped.map((value) => Math.abs(value)));

	const weightedRms1_24Db = weightedRmsForCurve(
		prepared.native1_24,
		prepared.target,
		filterResponse,
		prepared.reliability,
	);
	const weightedRms1_12Db = weightedRmsForCurve(
		prepared.octave1_12,
		prepared.target,
		filterResponse,
		prepared.reliability,
	);
	const broadRmsDb = weightedRmsForCurve(
		prepared.octave1_3,
		prepared.target,
		filterResponse,
		prepared.reliability,
	);

	const broadPredicted = computePredictedCurve(prepared.octave1_3, filterResponse);
	const overcut = computeOvercutAreaDbOct(broadPredicted, prepared.target);
	const excessAreaDbOct = computeExcessAreaDbOct(
		computePredictedCurve(prepared.octave1_12, filterResponse),
		prepared.target,
	);

	return {
		rmsErrorDb,
		maximumErrorDb,
		scalarError,
		weightedRmsErrorDb,
		weightedRms1_24Db,
		weightedRms1_12Db,
		broadRmsDb,
		overcutAreaDbOct: overcut.areaDbOct,
		excessAreaDbOct,
		maximumBroadOvercutDb: overcut.maximumOvercutDb,
	};
}

export { getTargetToleranceDb };

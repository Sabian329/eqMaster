import { BROAD_SMOOTHING_FRACTION } from "./constants";
import { frequencyWeight } from "./math";
import { smoothFractionalOctave } from "./smoothing";
import { getTargetToleranceDb } from "./tolerance";
import type { FrequencyPoint } from "./types";

export const BROAD_CUT_LIMIT_WEIGHT = 2.5;

export function getOvercutPenaltyMultiplier(frequency: number): number {
	// Bass resonance cuts intentionally undershoot locally; keep penalty mild there.
	if (frequency < 200) return 0.35;
	if (frequency < 1_000) return 0.85;
	if (frequency < 5_000) return 3.0;
	if (frequency < 10_000) return 3.5;
	return 2.5;
}

export function getMaximumBroadCutDb(frequency: number): number {
	if (frequency < 200) return -15;
	if (frequency < 1_000) return -8;
	if (frequency < 5_000) return -5.0;
	if (frequency < 10_000) return -4.0;
	return -3.0;
}

/** Safety pass reacts only after broad predicted falls below target by more than this. */
export function getAllowedBroadUndershootDb(frequency: number): number {
	if (frequency < 1_000) return 1.5;
	if (frequency < 5_000) return 2.0;
	if (frequency < 10_000) return 2.25;
	return 2.5;
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
		const overcutDb = Math.max(
			0,
			target[index].db - broadPredicted[index].db - toleranceDb,
		);
		penalty +=
			frequencyWeight(frequency) *
			overcutDb *
			overcutDb *
			getOvercutPenaltyMultiplier(frequency);
	}

	return penalty / Math.max(broadPredicted.length, 1);
}

export function computeBroadCutLimitPenalty(
	broadCombinedFilterResponse: FrequencyPoint[],
): number {
	let penalty = 0;

	for (const point of broadCombinedFilterResponse) {
		const maximumBroadCutDb = getMaximumBroadCutDb(point.frequency);
		const excessiveBroadCutDb = Math.max(
			0,
			maximumBroadCutDb - point.db,
		);
		penalty +=
			excessiveBroadCutDb * excessiveBroadCutDb * BROAD_CUT_LIMIT_WEIGHT;
	}

	return penalty / Math.max(broadCombinedFilterResponse.length, 1);
}

export function smoothToBroad(points: FrequencyPoint[]): FrequencyPoint[] {
	return smoothFractionalOctave(points, BROAD_SMOOTHING_FRACTION);
}

export function computeOvercutAreaDbOct(
	predicted: FrequencyPoint[],
	target: FrequencyPoint[],
): number {
	const broadPredicted = smoothToBroad(predicted);
	let area = 0;

	for (let index = 1; index < broadPredicted.length; index += 1) {
		const leftFrequency = broadPredicted[index - 1].frequency;
		const rightFrequency = broadPredicted[index].frequency;
		const octaveWidth = Math.abs(Math.log2(rightFrequency / leftFrequency));
		const leftOvercut = Math.max(
			0,
			target[index - 1].db - broadPredicted[index - 1].db,
		);
		const rightOvercut = Math.max(
			0,
			target[index].db - broadPredicted[index].db,
		);
		area += 0.5 * (leftOvercut + rightOvercut) * octaveWidth;
	}

	return area;
}

export function computeExcessAreaDbOct(
	predicted: FrequencyPoint[],
	target: FrequencyPoint[],
): number {
	const broadPredicted = smoothToBroad(predicted);
	let area = 0;

	for (let index = 1; index < broadPredicted.length; index += 1) {
		const leftFrequency = broadPredicted[index - 1].frequency;
		const rightFrequency = broadPredicted[index].frequency;
		const octaveWidth = Math.abs(Math.log2(rightFrequency / leftFrequency));
		const leftExcess = Math.max(
			0,
			broadPredicted[index - 1].db - target[index - 1].db,
		);
		const rightExcess = Math.max(
			0,
			broadPredicted[index].db - target[index].db,
		);
		area += 0.5 * (leftExcess + rightExcess) * octaveWidth;
	}

	return area;
}

export function computeMaximumBroadOvercutDb(
	predicted: FrequencyPoint[],
	target: FrequencyPoint[],
): number {
	const broadPredicted = smoothToBroad(predicted);
	let maximum = 0;

	for (let index = 0; index < broadPredicted.length; index += 1) {
		maximum = Math.max(
			0,
			maximum,
			target[index].db - broadPredicted[index].db,
		);
	}

	return maximum;
}

export function computeBroadRmsErrorDb(
	predicted: FrequencyPoint[],
	target: FrequencyPoint[],
): number {
	const broadPredicted = smoothToBroad(predicted);
	if (broadPredicted.length === 0) return 0;

	let sumSquares = 0;
	for (let index = 0; index < broadPredicted.length; index += 1) {
		const error = broadPredicted[index].db - target[index].db;
		sumSquares += error * error;
	}

	return Math.sqrt(sumSquares / broadPredicted.length);
}

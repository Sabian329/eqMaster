import { getFilterResponseDb } from "./biquadResponse";
import { calculateV4TotalCost, computeBroadOvercutPenalty, computePredictedCurve } from "./multiScaleCost";
import type { AutoEqV4Options, FrequencyPoint, PreparedV4Measurement, V4GeneratedFilter } from "./types";

export interface V4CandidateEvaluation {
	globalCostBefore: number;
	globalCostAfter: number;
	localCostBefore: number;
	localCostAfter: number;
	offBandCostBefore: number;
	offBandCostAfter: number;
	globalImprovement: number;
	localImprovement: number;
	offBandDamage: number;
	broadOvercutBefore: number;
	broadOvercutAfter: number;
}

export const MIN_GLOBAL_IMPROVEMENT = 1e-4;
export const MAX_ALLOWED_OFF_BAND_DAMAGE = 0.08;
export const ALLOWED_OVERCUT_INCREASE = 0.02;

function acceptanceLimits(
	frequency: number,
	reason?: string,
): { maximumAllowedOffBandDamage: number; allowedOvercutIncrease: number } {
	const resonance = reason === "resonance" || reason === "repeated-resonance";

	if (frequency < 200 && resonance) {
		return { maximumAllowedOffBandDamage: 1.25, allowedOvercutIncrease: 0.75 };
	}
	if (frequency < 1_000) {
		return {
			maximumAllowedOffBandDamage: resonance ? 0.75 : 0.35,
			allowedOvercutIncrease: resonance ? 0.35 : 0.12,
		};
	}
	const tonal = reason === "tonal-region" || reason === "high-shelf" || reason === "low-shelf";
	if (frequency < 5_000) {
		return {
			maximumAllowedOffBandDamage: tonal ? 0.25 : 0.12,
			allowedOvercutIncrease: tonal ? 0.12 : 0.04,
		};
	}
	return {
		maximumAllowedOffBandDamage: tonal ? 0.2 : MAX_ALLOWED_OFF_BAND_DAMAGE,
		allowedOvercutIncrease: tonal ? 0.1 : ALLOWED_OVERCUT_INCREASE,
	};
}

export function getLocalBandMask(
	filter: V4GeneratedFilter,
	grid: FrequencyPoint[],
	sampleRate: number,
): boolean[] {
	const threshold = Math.max(0.25 * Math.abs(filter.gainDb), 0.5);
	return grid.map((point) => {
		const response = Math.abs(getFilterResponseDb(filter, point.frequency, sampleRate));
		return response > threshold;
	});
}

function bandCostFromPredicted(
	prepared: PreparedV4Measurement,
	predicted: FrequencyPoint[],
	mask: boolean[],
	inBand: boolean,
): number {
	let total = 0;
	let weight = 0;

	for (let index = 0; index < predicted.length; index += 1) {
		const isLocal = mask[index];
		if (inBand ? !isLocal : isLocal) continue;
		const error = predicted[index].db - prepared.target[index].db;
		const pointWeight = prepared.reliability[index];
		total += error * error * pointWeight;
		weight += pointWeight;
	}

	return total / Math.max(weight, 1e-9);
}

export function evaluateV4CandidateAddition(
	prepared: PreparedV4Measurement,
	existing: V4GeneratedFilter[],
	candidate: V4GeneratedFilter,
	options: AutoEqV4Options,
): V4CandidateEvaluation {
	const beforeFilters = existing;
	const afterFilters = [...existing, candidate];

	const globalCostBefore = calculateV4TotalCost(prepared, beforeFilters, options).total;
	const globalCostAfter = calculateV4TotalCost(prepared, afterFilters, options).total;

	const mask = getLocalBandMask(candidate, prepared.grid, options.sampleRate);
	const filterResponseBefore = computeFilterResponseArray(beforeFilters, prepared.grid, options.sampleRate);
	const filterResponseAfter = computeFilterResponseArray(afterFilters, prepared.grid, options.sampleRate);

	const predictedBefore = computePredictedCurve(prepared.octave1_12, filterResponseBefore);
	const predictedAfter = computePredictedCurve(prepared.octave1_12, filterResponseAfter);

	const localCostBefore = bandCostFromPredicted(prepared, predictedBefore, mask, true);
	const localCostAfter = bandCostFromPredicted(prepared, predictedAfter, mask, true);
	const offBandCostBefore = bandCostFromPredicted(prepared, predictedBefore, mask, false);
	const offBandCostAfter = bandCostFromPredicted(prepared, predictedAfter, mask, false);

	const broadPredictedBefore = computePredictedCurve(prepared.octave1_3, filterResponseBefore);
	const broadPredictedAfter = computePredictedCurve(prepared.octave1_3, filterResponseAfter);
	const broadOvercutBefore = computeBroadOvercutPenalty(broadPredictedBefore, prepared.target);
	const broadOvercutAfter = computeBroadOvercutPenalty(broadPredictedAfter, prepared.target);

	return {
		globalCostBefore,
		globalCostAfter,
		localCostBefore,
		localCostAfter,
		offBandCostBefore,
		offBandCostAfter,
		globalImprovement: globalCostBefore - globalCostAfter,
		localImprovement: localCostBefore - localCostAfter,
		offBandDamage: Math.max(0, offBandCostAfter - offBandCostBefore),
		broadOvercutBefore,
		broadOvercutAfter,
	};
}

function computeFilterResponseArray(
	filters: V4GeneratedFilter[],
	grid: FrequencyPoint[],
	sampleRate: number,
): number[] {
	return grid.map((point) =>
		filters.reduce((sum, filter) => {
			if (!filter.enabled || Math.abs(filter.gainDb) < 0.01) return sum;
			return sum + getFilterResponseDb(filter, point.frequency, sampleRate);
		}, 0),
	);
}

export function acceptsV4CandidateEvaluation(
	evaluation: V4CandidateEvaluation,
	context?: {
		frequency?: number;
		reason?: string;
		minimumGlobalImprovement?: number;
		maximumAllowedOffBandDamage?: number;
		allowedOvercutIncrease?: number;
	},
): boolean {
	const limits = acceptanceLimits(context?.frequency ?? 1_000, context?.reason);
	const minimumGlobalImprovement = context?.minimumGlobalImprovement ?? MIN_GLOBAL_IMPROVEMENT;
	const maximumAllowedOffBandDamage =
		context?.maximumAllowedOffBandDamage ?? limits.maximumAllowedOffBandDamage;
	const allowedOvercutIncrease = context?.allowedOvercutIncrease ?? limits.allowedOvercutIncrease;

	return (
		evaluation.globalImprovement > minimumGlobalImprovement &&
		evaluation.localImprovement > 0 &&
		evaluation.offBandDamage <= maximumAllowedOffBandDamage &&
		evaluation.broadOvercutAfter <= evaluation.broadOvercutBefore + allowedOvercutIncrease
	);
}

export function overlapOctaves(left: V4GeneratedFilter, right: V4GeneratedFilter): number {
	const leftFrom = Math.log2(left.affectedRange.fromHz);
	const leftTo = Math.log2(left.affectedRange.toHz);
	const rightFrom = Math.log2(right.affectedRange.fromHz);
	const rightTo = Math.log2(right.affectedRange.toHz);
	return Math.max(0, Math.min(leftTo, rightTo) - Math.max(leftFrom, rightFrom));
}

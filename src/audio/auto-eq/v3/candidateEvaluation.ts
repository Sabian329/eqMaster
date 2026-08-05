import { getFilterResponseDb } from "./biquadResponse";
import { calculateTotalCost, computePredictedCurve } from "./costFunction";
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

export interface CandidateEvaluation {
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

export interface CorrectionRegion {
	id: string;
	fromHz: number;
	toHz: number;
	category: "resonance" | "tonal" | "shelf";
	filterIds: string[];
}

export const MIN_GLOBAL_IMPROVEMENT = 1e-4;
export const MAX_ALLOWED_OFF_BAND_DAMAGE = 0.08;
export const ALLOWED_OVERCUT_INCREASE = 0.02;

function acceptanceLimits(frequency: number, reason?: string): {
	maximumAllowedOffBandDamage: number;
	allowedOvercutIncrease: number;
} {
	const resonance =
		reason === "local-resonance" || reason === "repeated-resonance";

	if (frequency < 200 && resonance) {
		return {
			maximumAllowedOffBandDamage: 1.25,
			allowedOvercutIncrease: 0.75,
		};
	}
	if (frequency < 1_000) {
		return {
			maximumAllowedOffBandDamage: resonance ? 0.75 : 0.35,
			allowedOvercutIncrease: resonance ? 0.35 : 0.12,
		};
	}
	if (frequency < 5_000) {
		return {
			maximumAllowedOffBandDamage: 0.12,
			allowedOvercutIncrease: 0.04,
		};
	}
	return {
		maximumAllowedOffBandDamage: MAX_ALLOWED_OFF_BAND_DAMAGE,
		allowedOvercutIncrease: ALLOWED_OVERCUT_INCREASE,
	};
}

export function getLocalBandMask(
	filter: GeneratedEqFilter,
	grid: FrequencyPoint[],
	sampleRate: number,
): boolean[] {
	const threshold = Math.max(0.25 * Math.abs(filter.gainDb), 0.5);
	return grid.map((point) => {
		const response = Math.abs(
			getFilterResponseDb(
				{
					type: filter.type,
					frequency: filter.frequency,
					gainDb: filter.gainDb,
					q: filter.q,
				},
				point.frequency,
				sampleRate,
			),
		);
		return response > threshold;
	});
}

function bandCostFromPredicted(
	prepared: PreparedMeasurement,
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

export function evaluateCandidateAddition(
	prepared: PreparedMeasurement,
	measurements: FrequencyPoint[][],
	existing: GeneratedEqFilter[],
	candidate: GeneratedEqFilter,
	options: AutoEqV3Options,
): CandidateEvaluation {
	const beforeFilters = existing;
	const afterFilters = [...existing, candidate];

	const globalCostBefore = calculateTotalCost(
		prepared,
		measurements,
		beforeFilters,
		options,
	).total;
	const globalCostAfter = calculateTotalCost(
		prepared,
		measurements,
		afterFilters,
		options,
	).total;

	const mask = getLocalBandMask(
		candidate,
		prepared.detailed,
		options.sampleRate,
	);

	const predictedBefore = computePredictedCurve(
		prepared,
		beforeFilters,
		options,
	);
	const predictedAfter = computePredictedCurve(prepared, afterFilters, options);

	const localCostBefore = bandCostFromPredicted(
		prepared,
		predictedBefore,
		mask,
		true,
	);
	const localCostAfter = bandCostFromPredicted(
		prepared,
		predictedAfter,
		mask,
		true,
	);
	const offBandCostBefore = bandCostFromPredicted(
		prepared,
		predictedBefore,
		mask,
		false,
	);
	const offBandCostAfter = bandCostFromPredicted(
		prepared,
		predictedAfter,
		mask,
		false,
	);

	const broadOvercutBefore = computeBroadOvercutPenalty(
		smoothToBroad(predictedBefore),
		prepared.target,
	);
	const broadOvercutAfter = computeBroadOvercutPenalty(
		smoothToBroad(predictedAfter),
		prepared.target,
	);

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

export function acceptsCandidateEvaluation(
	evaluation: CandidateEvaluation,
	context?: {
		frequency?: number;
		reason?: string;
		minimumGlobalImprovement?: number;
		maximumAllowedOffBandDamage?: number;
		allowedOvercutIncrease?: number;
	},
): boolean {
	const limits = acceptanceLimits(
		context?.frequency ?? 1_000,
		context?.reason,
	);
	const minimumGlobalImprovement =
		context?.minimumGlobalImprovement ?? MIN_GLOBAL_IMPROVEMENT;
	const maximumAllowedOffBandDamage =
		context?.maximumAllowedOffBandDamage ??
		limits.maximumAllowedOffBandDamage;
	const allowedOvercutIncrease =
		context?.allowedOvercutIncrease ?? limits.allowedOvercutIncrease;

	return (
		evaluation.globalImprovement > minimumGlobalImprovement &&
		evaluation.localImprovement > 0 &&
		evaluation.offBandDamage <= maximumAllowedOffBandDamage &&
		evaluation.broadOvercutAfter <=
			evaluation.broadOvercutBefore + allowedOvercutIncrease
	);
}

export function overlapOctaves(
	left: GeneratedEqFilter,
	right: GeneratedEqFilter,
): number {
	const leftFrom = Math.log2(left.affectedRange.fromHz);
	const leftTo = Math.log2(left.affectedRange.toHz);
	const rightFrom = Math.log2(right.affectedRange.fromHz);
	const rightTo = Math.log2(right.affectedRange.toHz);
	const overlap = Math.min(leftTo, rightTo) - Math.max(leftFrom, rightFrom);
	return Math.max(0, overlap);
}

export function buildCorrectionRegions(
	filters: GeneratedEqFilter[],
): CorrectionRegion[] {
	const regions: CorrectionRegion[] = [];

	for (const filter of filters) {
		const category =
			filter.reason === "broad-tonal-error"
				? "tonal"
				: filter.reason === "low-frequency-tilt" ||
					  filter.reason === "high-frequency-tilt"
					? "shelf"
					: "resonance";

		const existing = regions.find(
			(region) =>
				region.category === category &&
				!(
					filter.affectedRange.toHz < region.fromHz ||
					filter.affectedRange.fromHz > region.toHz
				),
		);

		if (existing) {
			existing.fromHz = Math.min(existing.fromHz, filter.affectedRange.fromHz);
			existing.toHz = Math.max(existing.toHz, filter.affectedRange.toHz);
			existing.filterIds.push(filter.id);
		} else {
			regions.push({
				id: `region-${filter.id}`,
				fromHz: filter.affectedRange.fromHz,
				toHz: filter.affectedRange.toHz,
				category,
				filterIds: [filter.id],
			});
		}
	}

	return regions;
}

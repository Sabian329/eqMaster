import { NULL_DEPTH_DB } from "./constants";
import type { FrequencyPoint, PreparedMeasurement } from "./types";

export const MIN_BROAD_REGION_OCTAVES = 0.75;
export const MIN_POSITIVE_ERROR_COVERAGE = 0.7;
export const STRONG_POSITIVE_ERROR_COVERAGE = 0.8;
export const MIN_AVERAGE_EXCESS_DB = 2;

export interface BroadRegionStats {
	fromHz: number;
	toHz: number;
	bandwidthOctaves: number;
	pointsInRegion: number;
	pointsAboveTarget: number;
	positiveErrorCoverage: number;
	averageExcessDb: number;
	hasDominantDeepNull: boolean;
	qualifiesForStrongBroadCut: boolean;
}

export function getBroadCorrectionStrength(
	positiveErrorCoverage: number,
): number {
	return positiveErrorCoverage >= STRONG_POSITIVE_ERROR_COVERAGE ? 0.75 : 0.5;
}

export function regionQualifiesForStrongBroadCut(stats: {
	bandwidthOctaves: number;
	positiveErrorCoverage: number;
	averageExcessDb: number;
	hasDominantDeepNull: boolean;
}): boolean {
	return (
		stats.bandwidthOctaves >= MIN_BROAD_REGION_OCTAVES &&
		stats.positiveErrorCoverage >= MIN_POSITIVE_ERROR_COVERAGE &&
		stats.averageExcessDb > MIN_AVERAGE_EXCESS_DB &&
		!stats.hasDominantDeepNull
	);
}

export function analyzeBroadRegion(
	prepared: PreparedMeasurement,
	startIndex: number,
	endIndex: number,
): BroadRegionStats {
	const { broad, target, tonalError } = prepared;
	const last = Math.min(endIndex - 1, broad.length - 1);
	const first = Math.max(0, startIndex);
	const fromHz = broad[first].frequency;
	const toHz = broad[last].frequency;
	const bandwidthOctaves = Math.abs(Math.log2(toHz / Math.max(fromHz, 1)));

	let pointsInRegion = 0;
	let pointsAboveTarget = 0;
	let excessSum = 0;
	let deepestNullDb = 0;

	for (let index = first; index <= last; index += 1) {
		pointsInRegion += 1;
		const errorDb = tonalError[index]?.db ?? broad[index].db - target[index].db;
		if (errorDb > 0) {
			pointsAboveTarget += 1;
			excessSum += errorDb;
		} else if (errorDb < deepestNullDb) {
			deepestNullDb = errorDb;
		}
	}

	const positiveErrorCoverage =
		pointsAboveTarget / Math.max(pointsInRegion, 1);
	const averageExcessDb =
		excessSum / Math.max(pointsAboveTarget, 1);
	const hasDominantDeepNull =
		deepestNullDb <= -NULL_DEPTH_DB &&
		positiveErrorCoverage < STRONG_POSITIVE_ERROR_COVERAGE;

	const stats = {
		fromHz,
		toHz,
		bandwidthOctaves,
		pointsInRegion,
		pointsAboveTarget,
		positiveErrorCoverage,
		averageExcessDb,
		hasDominantDeepNull,
		qualifiesForStrongBroadCut: false,
	};
	stats.qualifiesForStrongBroadCut = regionQualifiesForStrongBroadCut(stats);
	return stats;
}

/**
 * Squared-error improvement on points that were already above target.
 */
export function computeBroadImprovement(
	predictedBefore: FrequencyPoint[],
	predictedAfter: FrequencyPoint[],
	target: FrequencyPoint[],
	reliability: Float64Array,
	mask?: boolean[],
): number {
	let improvement = 0;

	for (let index = 0; index < predictedBefore.length; index += 1) {
		if (mask && !mask[index]) continue;
		const errorBefore = predictedBefore[index].db - target[index].db;
		if (errorBefore <= 0) continue;
		const errorAfter = predictedAfter[index].db - target[index].db;
		const weight = reliability[index] ?? 1;
		const beforeSq = errorBefore * errorBefore;
		const afterSq = errorAfter * errorAfter;
		improvement += Math.max(0, beforeSq - afterSq) * weight;
	}

	return improvement;
}

/**
 * Squared-error increase on points that were already below target.
 */
export function computeBelowTargetDamage(
	predictedBefore: FrequencyPoint[],
	predictedAfter: FrequencyPoint[],
	target: FrequencyPoint[],
	reliability: Float64Array,
	mask?: boolean[],
): number {
	let damage = 0;

	for (let index = 0; index < predictedBefore.length; index += 1) {
		if (mask && !mask[index]) continue;
		const errorBefore = predictedBefore[index].db - target[index].db;
		if (errorBefore >= 0) continue;
		const errorAfter = predictedAfter[index].db - target[index].db;
		const weight = reliability[index] ?? 1;
		const beforeSq = errorBefore * errorBefore;
		const afterSq = errorAfter * errorAfter;
		damage += Math.max(0, afterSq - beforeSq) * weight;
	}

	return damage;
}

export function acceptsBroadCutNullSafety(
	broadImprovement: number,
	belowTargetDamage: number,
): boolean {
	return broadImprovement > belowTargetDamage * 2;
}

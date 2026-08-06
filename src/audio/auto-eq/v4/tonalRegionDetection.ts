import { MIN_PROMINENCE_DB, MIN_TONAL_ERROR_DB, MIN_TONAL_WIDTH_OCTAVES, NULL_DEPTH_DB } from "./constants";
import type { PreparedV4Measurement, V4TonalRegion } from "./types";

export const MIN_BROAD_REGION_OCTAVES = 0.75;
export const MIN_POSITIVE_ERROR_COVERAGE = 0.7;
export const STRONG_POSITIVE_ERROR_COVERAGE = 0.8;
export const MIN_AVERAGE_EXCESS_DB = 2;

export interface RegionStats {
	fromHz: number;
	toHz: number;
	bandwidthOctaves: number;
	positiveErrorCoverage: number;
	averageExcessDb: number;
	hasDominantDeepNull: boolean;
	qualifiesForStrongCut: boolean;
}

export function getBroadCorrectionStrength(positiveErrorCoverage: number): number {
	return positiveErrorCoverage >= STRONG_POSITIVE_ERROR_COVERAGE ? 0.75 : 0.5;
}

export function analyzeRegion(
	errorCurve: { frequency: number; db: number }[],
	startIndex: number,
	endIndexExclusive: number,
): RegionStats {
	const last = Math.min(endIndexExclusive - 1, errorCurve.length - 1);
	const first = Math.max(0, startIndex);
	const fromHz = errorCurve[first].frequency;
	const toHz = errorCurve[last].frequency;
	const bandwidthOctaves = Math.abs(Math.log2(toHz / Math.max(fromHz, 1)));

	let pointsInRegion = 0;
	let pointsAboveTarget = 0;
	let excessSum = 0;
	let deepestNullDb = 0;

	for (let index = first; index <= last; index += 1) {
		pointsInRegion += 1;
		const errorDb = errorCurve[index].db;
		if (errorDb > 0) {
			pointsAboveTarget += 1;
			excessSum += errorDb;
		} else if (errorDb < deepestNullDb) {
			deepestNullDb = errorDb;
		}
	}

	const positiveErrorCoverage = pointsAboveTarget / Math.max(pointsInRegion, 1);
	const averageExcessDb = excessSum / Math.max(pointsAboveTarget, 1);
	const hasDominantDeepNull =
		deepestNullDb <= -NULL_DEPTH_DB && positiveErrorCoverage < STRONG_POSITIVE_ERROR_COVERAGE;

	const qualifiesForStrongCut =
		bandwidthOctaves >= MIN_BROAD_REGION_OCTAVES &&
		positiveErrorCoverage >= MIN_POSITIVE_ERROR_COVERAGE &&
		averageExcessDb > MIN_AVERAGE_EXCESS_DB &&
		!hasDominantDeepNull;

	return {
		fromHz,
		toHz,
		bandwidthOctaves,
		positiveErrorCoverage,
		averageExcessDb,
		hasDominantDeepNull,
		qualifiesForStrongCut,
	};
}

function regionHasBlockingLocalPeaks(
	prepared: PreparedV4Measurement,
	start: number,
	end: number,
	centerFrequency: number,
): boolean {
	if (centerFrequency >= 1_000) return false;

	const { narrowResidual } = prepared;
	let peakCount = 0;
	let samples = 0;

	for (let index = start + 1; index < end - 1; index += 1) {
		samples += 1;
		const narrowDb = narrowResidual[index].db;
		if (narrowDb < MIN_PROMINENCE_DB) continue;
		if (narrowDb > narrowResidual[index - 1].db && narrowDb > narrowResidual[index + 1].db) {
			peakCount += 1;
		}
	}

	return peakCount > 0 && peakCount / Math.max(samples, 1) > 0.08;
}

/**
 * Broad tonal regions detected on the mid scale (1/6 octave) vs target,
 * covering errors too wide/gradual to be modeled as a single resonance.
 */
export function detectTonalRegions(prepared: PreparedV4Measurement): V4TonalRegion[] {
	const regions: V4TonalRegion[] = [];
	const { tonalError, octave1_6, reliability } = prepared;
	let start = 0;

	while (start < tonalError.length) {
		const sign = Math.sign(tonalError[start].db);
		if (sign === 0 || Math.abs(tonalError[start].db) < MIN_TONAL_ERROR_DB) {
			start += 1;
			continue;
		}

		let end = start + 1;
		while (
			end < tonalError.length &&
			Math.sign(tonalError[end].db) === sign &&
			Math.abs(tonalError[end].db) >= MIN_TONAL_ERROR_DB * 0.8
		) {
			end += 1;
		}

		const bandwidthOctaves = Math.log2(
			octave1_6[Math.min(end - 1, octave1_6.length - 1)].frequency /
				octave1_6[start].frequency,
		);

		const slice = tonalError.slice(start, end);
		const averageError =
			slice.reduce((sum, point) => sum + point.db, 0) / Math.max(slice.length, 1);
		const averageRel =
			slice.reduce((sum, _, index) => sum + reliability[start + index], 0) /
			Math.max(slice.length, 1);

		const centerIndex = Math.floor((start + end - 1) / 2);
		const centerFrequency = octave1_6[centerIndex].frequency;
		const minWidth =
			centerFrequency >= 1_000 ? Math.max(MIN_TONAL_WIDTH_OCTAVES, 0.75) : MIN_TONAL_WIDTH_OCTAVES;

		const stats = analyzeRegion(tonalError, start, end);

		if (
			bandwidthOctaves >= minWidth &&
			Math.abs(averageError) >= MIN_TONAL_ERROR_DB &&
			averageRel >= 0.45 &&
			!regionHasBlockingLocalPeaks(prepared, start, end, centerFrequency) &&
			!(averageError > 0 && stats.hasDominantDeepNull)
		) {
			regions.push({
				frequency: centerFrequency,
				fromHz: stats.fromHz,
				toHz: stats.toHz,
				errorDb: averageError,
				bandwidthOctaves,
				reliability: averageRel,
				positiveErrorCoverage: stats.positiveErrorCoverage,
				averageExcessDb: stats.averageExcessDb,
				hasDominantDeepNull: stats.hasDominantDeepNull,
			});
		}

		start = end;
	}

	return regions.sort((a, b) => Math.abs(b.errorDb) - Math.abs(a.errorDb));
}

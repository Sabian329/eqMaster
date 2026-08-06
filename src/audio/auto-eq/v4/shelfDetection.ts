import { MIN_TONAL_ERROR_DB, MIN_TONAL_WIDTH_OCTAVES } from "./constants";
import { analyzeRegion, detectTonalRegions } from "./tonalRegionDetection";
import type { PreparedV4Measurement, V4ShelfCandidate } from "./types";

function clampShelfFrequency(frequency: number): number {
	return Math.min(12_000, Math.max(5_500, frequency));
}

function detectHighFrequencyShelfFromBroad(
	prepared: PreparedV4Measurement,
): V4ShelfCandidate | null {
	const { octave1_3, target, reliability } = prepared;
	const indices: number[] = [];
	const points: { frequency: number; errorDb: number; reliability: number }[] = [];

	for (let index = 0; index < octave1_3.length; index += 1) {
		const frequency = octave1_3[index].frequency;
		if (frequency < 5_000 || frequency > 20_000) continue;
		const errorDb = octave1_3[index].db - target[index].db;
		if (errorDb <= 0) continue;
		indices.push(index);
		points.push({ frequency, errorDb, reliability: reliability[index] });
	}

	if (points.length < 8) return null;

	const averageError = points.reduce((sum, point) => sum + point.errorDb, 0) / points.length;
	const averageRel = points.reduce((sum, point) => sum + point.reliability, 0) / points.length;
	const fromHz = points[0].frequency;
	const toHz = points[points.length - 1].frequency;
	const widthOctaves = Math.log2(toHz / fromHz);

	if (averageError < MIN_TONAL_ERROR_DB || widthOctaves < 0.75) return null;

	const stats = analyzeRegion(
		octave1_3.map((point, index) => ({ frequency: point.frequency, db: point.db - target[index].db })),
		indices[0],
		indices[indices.length - 1] + 1,
	);

	if (stats.hasDominantDeepNull) return null;

	return {
		type: "HS",
		frequency: clampShelfFrequency(Math.sqrt(fromHz * toHz)),
		errorDb: averageError,
		reliability: averageRel,
		positiveErrorCoverage: stats.positiveErrorCoverage,
		averageExcessDb: stats.averageExcessDb,
		hasDominantDeepNull: stats.hasDominantDeepNull,
	};
}

/** Low/high shelf candidates from tonal regions at the frequency extremes. */
export function detectShelves(prepared: PreparedV4Measurement): V4ShelfCandidate[] {
	const regions = detectTonalRegions(prepared);
	const shelves: V4ShelfCandidate[] = [];

	for (const region of regions) {
		if (Math.abs(region.errorDb) < MIN_TONAL_ERROR_DB) continue;
		if (region.bandwidthOctaves < MIN_TONAL_WIDTH_OCTAVES) continue;

		if (region.frequency < 250) {
			shelves.push({
				type: "LS",
				frequency: Math.max(40, region.frequency * 0.7),
				errorDb: region.errorDb,
				reliability: region.reliability,
				positiveErrorCoverage: region.positiveErrorCoverage,
				averageExcessDb: region.averageExcessDb,
				hasDominantDeepNull: region.hasDominantDeepNull,
			});
		}

		if (region.frequency > 5_000) {
			shelves.push({
				type: "HS",
				frequency: clampShelfFrequency(region.frequency),
				errorDb: region.errorDb,
				reliability: region.reliability,
				positiveErrorCoverage: region.positiveErrorCoverage,
				averageExcessDb: region.averageExcessDb,
				hasDominantDeepNull: region.hasDominantDeepNull,
			});
		}
	}

	const broadHfShelf = detectHighFrequencyShelfFromBroad(prepared);
	if (broadHfShelf && !shelves.some((shelf) => shelf.type === "HS" && shelf.errorDb > 0)) {
		shelves.push(broadHfShelf);
	}

	return shelves.sort((a, b) => Math.abs(b.errorDb) - Math.abs(a.errorDb));
}

/** Tonal-region (non-shelf) candidates: regions centered away from the band extremes. */
export function detectTonalOnly(prepared: PreparedV4Measurement) {
	return detectTonalRegions(prepared).filter(
		(region) => region.frequency >= 250 && region.frequency <= 5_000,
	);
}

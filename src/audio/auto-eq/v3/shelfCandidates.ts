import { MIN_TONAL_ERROR_DB, MIN_TONAL_WIDTH_OCTAVES } from "./constants";
import { applyTolerance, getTargetToleranceDb } from "./tolerance";
import type { PreparedMeasurement, ShelfCandidate } from "./types";
import { detectTonalCandidates } from "./tonalCandidates";

function detectHighFrequencyShelfFromBroad(
	prepared: PreparedMeasurement,
): ShelfCandidate | null {
	const { broad, target, reliability } = prepared;
	const points: { frequency: number; errorDb: number; reliability: number }[] =
		[];

	for (let index = 0; index < broad.length; index += 1) {
		const frequency = broad[index].frequency;
		if (frequency < 5_000 || frequency > 20_000) continue;
		const errorDb = broad[index].db - target[index].db;
		const tolerated = applyTolerance(
			errorDb,
			getTargetToleranceDb(frequency),
		);
		if (tolerated <= 0) continue;
		points.push({
			frequency,
			errorDb: tolerated,
			reliability: reliability[index],
		});
	}

	if (points.length < 8) return null;

	const averageError =
		points.reduce((sum, point) => sum + point.errorDb, 0) / points.length;
	const averageRel =
		points.reduce((sum, point) => sum + point.reliability, 0) / points.length;
	const fromHz = points[0].frequency;
	const toHz = points[points.length - 1].frequency;
	const widthOctaves = Math.log2(toHz / fromHz);

	if (averageError < MIN_TONAL_ERROR_DB || widthOctaves < 0.75) return null;

	return {
		type: "HS",
		frequency: clampShelfFrequency(Math.sqrt(fromHz * toHz)),
		errorDb: averageError,
		reason: "high-frequency-tilt",
		reliability: averageRel,
	};
}

function clampShelfFrequency(frequency: number): number {
	return Math.min(12_000, Math.max(5_500, frequency));
}

export function detectShelfCandidates(
	prepared: PreparedMeasurement,
): ShelfCandidate[] {
	const tonal = detectTonalCandidates(prepared);
	const shelves: ShelfCandidate[] = [];

	for (const segment of tonal) {
		if (
			segment.reason !== "low-frequency-tilt" &&
			segment.reason !== "high-frequency-tilt"
		) {
			continue;
		}
		if (Math.abs(segment.errorDb) < MIN_TONAL_ERROR_DB) continue;
		if (segment.bandwidthOctaves < MIN_TONAL_WIDTH_OCTAVES) continue;

		if (segment.reason === "low-frequency-tilt" && segment.frequency < 250) {
			shelves.push({
				type: "LS",
				frequency: Math.max(40, segment.frequency * 0.7),
				errorDb: segment.errorDb,
				reason: segment.reason,
				reliability: segment.reliability,
			});
		}

		if (segment.reason === "high-frequency-tilt" && segment.frequency > 5_000) {
			shelves.push({
				type: "HS",
				frequency: clampShelfFrequency(segment.frequency),
				errorDb: segment.errorDb,
				reason: segment.reason,
				reliability: segment.reliability,
			});
		}
	}

	const broadHfShelf = detectHighFrequencyShelfFromBroad(prepared);
	if (
		broadHfShelf &&
		!shelves.some((shelf) => shelf.type === "HS" && shelf.errorDb > 0)
	) {
		shelves.push(broadHfShelf);
	}

	return shelves.sort((a, b) => Math.abs(b.errorDb) - Math.abs(a.errorDb));
}

import {
	EXPECTED_OCTAVE_STEP_1_24,
	MIN_POINTS_PER_OCTAVE_FOR_V4,
	MIN_RAW_POINTS,
} from "./constants";
import { median } from "./math";
import type { FrequencyPoint, V4MeasurementResolution } from "./types";

export function sanitizeRawCurve(points: FrequencyPoint[]): FrequencyPoint[] {
	const valid = points
		.filter(
			(point) =>
				Number.isFinite(point.frequency) &&
				Number.isFinite(point.db) &&
				point.frequency > 0,
		)
		.sort((a, b) => a.frequency - b.frequency);

	const deduplicated: FrequencyPoint[] = [];
	for (const point of valid) {
		const previous = deduplicated.at(-1);
		if (previous && Math.abs(previous.frequency - point.frequency) < 1e-6) {
			previous.db = (previous.db + point.db) / 2;
		} else {
			deduplicated.push({ ...point });
		}
	}

	return deduplicated;
}

interface RawResolutionStats {
	medianOctaveStep: number;
	minimumOctaveStep: number;
	maximumOctaveStep: number;
	pointCount: number;
	duplicatedPointCount: number;
	invalidPointCount: number;
}

function computeRawResolutionStats(
	raw: FrequencyPoint[],
): RawResolutionStats | null {
	const invalidPointCount = raw.filter(
		(point) =>
			!(
				Number.isFinite(point.frequency) &&
				Number.isFinite(point.db) &&
				point.frequency > 0
			),
	).length;
	const sorted = [...raw]
		.filter(
			(point) =>
				Number.isFinite(point.frequency) &&
				Number.isFinite(point.db) &&
				point.frequency > 0,
		)
		.sort((a, b) => a.frequency - b.frequency);

	let duplicatedPointCount = 0;
	for (let index = 1; index < sorted.length; index += 1) {
		if (Math.abs(sorted[index].frequency - sorted[index - 1].frequency) < 1e-6) {
			duplicatedPointCount += 1;
		}
	}

	const sanitized = sanitizeRawCurve(raw);
	if (sanitized.length < MIN_RAW_POINTS) return null;

	const steps: number[] = [];
	for (let index = 1; index < sanitized.length; index += 1) {
		const step = Math.log2(
			sanitized[index].frequency / sanitized[index - 1].frequency,
		);
		if (Number.isFinite(step) && step > 0) steps.push(step);
	}
	if (steps.length === 0) return null;

	return {
		medianOctaveStep: median(steps),
		minimumOctaveStep: Math.min(...steps),
		maximumOctaveStep: Math.max(...steps),
		pointCount: sanitized.length,
		duplicatedPointCount,
		invalidPointCount,
	};
}

/**
 * Detects artificially densified 1/12→1/24 grids: median step near 1/24, but
 * odd samples are geometric midpoints of a coarser 1/12 lattice and/or dB
 * values are exact linear interpolants of their neighbors.
 */
export function looksLikeInterpolatedFrom1_12(raw: FrequencyPoint[]): boolean {
	const sanitized = sanitizeRawCurve(raw);
	if (sanitized.length < MIN_RAW_POINTS) return false;

	const steps: number[] = [];
	for (let index = 1; index < sanitized.length; index += 1) {
		const step = Math.log2(
			sanitized[index].frequency / sanitized[index - 1].frequency,
		);
		if (Number.isFinite(step) && step > 0) steps.push(step);
	}
	if (steps.length < 8) return false;

	const medianStep = median(steps);
	const near1_24 =
		Math.abs(medianStep - EXPECTED_OCTAVE_STEP_1_24) / EXPECTED_OCTAVE_STEP_1_24 <
		0.25;
	if (!near1_24) return false;

	let geometricMidpoints = 0;
	let linearDbMidpoints = 0;
	let checked = 0;
	for (let index = 1; index < sanitized.length - 1; index += 2) {
		const left = sanitized[index - 1];
		const middle = sanitized[index];
		const right = sanitized[index + 1];
		const expectedFrequency = Math.sqrt(left.frequency * right.frequency);
		const expectedDb = (left.db + right.db) / 2;
		const frequencyError =
			Math.abs(Math.log2(middle.frequency / expectedFrequency));
		if (frequencyError < 1e-4) geometricMidpoints += 1;
		if (Math.abs(middle.db - expectedDb) < 1e-6) linearDbMidpoints += 1;
		checked += 1;
	}

	if (checked === 0) return false;
	return (
		geometricMidpoints / checked > 0.7 || linearDbMidpoints / checked > 0.7
	);
}

/**
 * V4 requires RAW (unsmoothed, single-bin FFT) measurement curves dense enough
 * to derive a genuine native 1/24-octave curve via Gaussian smoothing. This
 * throws a descriptive error (containing "v4-requires-native-1-24-data") when
 * that precondition cannot be met.
 */
export function validateV4MeasurementResolution(
	measurements: FrequencyPoint[][],
): V4MeasurementResolution {
	if (!measurements || measurements.length === 0) {
		throw new Error(
			"v4-requires-native-1-24-data: at least one RAW measurement curve is required",
		);
	}

	if (measurements.some((raw) => looksLikeInterpolatedFrom1_12(raw))) {
		throw new Error(
			"v4-requires-native-1-24-data: measurement appears interpolated from 1/12 and is not native 1/24 data",
		);
	}

	const stats = measurements
		.map((raw) => computeRawResolutionStats(raw))
		.filter((entry): entry is RawResolutionStats => entry !== null);

	if (stats.length === 0) {
		throw new Error(
			`v4-requires-native-1-24-data: RAW curves need at least ${MIN_RAW_POINTS} valid points to derive a native 1/24-octave curve`,
		);
	}

	const medianOctaveStep = median(stats.map((entry) => entry.medianOctaveStep));
	const pointsPerOctave = medianOctaveStep > 0 ? 1 / medianOctaveStep : 0;
	const isNativeResolution = pointsPerOctave >= MIN_POINTS_PER_OCTAVE_FOR_V4;

	if (!isNativeResolution) {
		throw new Error(
			`v4-requires-native-1-24-data: RAW measurement resolution (~${pointsPerOctave.toFixed(1)} pts/octave) is below the native 1/24-octave requirement (~${MIN_POINTS_PER_OCTAVE_FOR_V4} pts/octave)`,
		);
	}

	return {
		source: "raw-derived-1/24",
		pointsPerOctave,
		isNativeResolution,
		medianOctaveStep,
		minimumOctaveStep: Math.min(...stats.map((entry) => entry.minimumOctaveStep)),
		maximumOctaveStep: Math.max(...stats.map((entry) => entry.maximumOctaveStep)),
		missingPointCount: 0,
		duplicatedPointCount: stats.reduce(
			(sum, entry) => sum + entry.duplicatedPointCount,
			0,
		),
		invalidPointCount: stats.reduce((sum, entry) => sum + entry.invalidPointCount, 0),
		measurementCount: measurements.length,
	};
}

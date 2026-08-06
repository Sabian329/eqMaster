import { NULL_DEPTH_DB, NULL_MAX_BANDWIDTH_OCT } from "./constants";
import { findHalfHeightBounds } from "./math";
import type { FrequencyPoint } from "./types";

export interface DeepNullRegion {
	index: number;
	frequency: number;
	depthDb: number;
	bandwidthOctaves: number;
}

/**
 * Deep, narrow nulls (depth >= NULL_DEPTH_DB, bandwidth < NULL_MAX_BANDWIDTH_OCT)
 * on the fine residual (native1_24 - octave1_12) are treated as un-correctable
 * acoustic cancellations rather than tonal errors to be boosted out.
 */
export function detectDeepNulls(
	grid: FrequencyPoint[],
	narrowResidual: FrequencyPoint[],
): DeepNullRegion[] {
	const frequencies = grid.map((point) => point.frequency);
	const values = narrowResidual.map((point) => point.db);
	const nulls: DeepNullRegion[] = [];

	for (let index = 1; index < values.length - 1; index += 1) {
		const isLocalMin = values[index] < values[index - 1] && values[index] < values[index + 1];
		if (!isLocalMin || values[index] > -NULL_DEPTH_DB) continue;

		const bounds = findHalfHeightBounds(
			values,
			frequencies,
			index,
			Math.abs(values[index]) * 0.5,
		);
		const bandwidthOctaves = Math.log2(
			bounds.upperFrequency / Math.max(bounds.lowerFrequency, 1),
		);
		if (bandwidthOctaves > NULL_MAX_BANDWIDTH_OCT) continue;

		nulls.push({
			index,
			frequency: grid[index].frequency,
			depthDb: Math.abs(values[index]),
			bandwidthOctaves,
		});
	}

	return nulls;
}

/**
 * Comb filtering produces nulls evenly spaced in *linear* Hz (harmonics of a
 * reflection delay), unlike single acoustic resonances. Flags null clusters
 * whose frequencies are consistent with f0, 2*f0, 3*f0, ... within tolerance.
 */
export function detectCombArtifactFrequencies(
	nulls: DeepNullRegion[],
): Set<number> {
	const flagged = new Set<number>();
	const tolerance = 0.06;

	for (let i = 0; i < nulls.length; i += 1) {
		let harmonicMatches = 0;
		for (let j = 0; j < nulls.length; j += 1) {
			if (i === j) continue;
			const ratio = nulls[j].frequency / nulls[i].frequency;
			const nearestHarmonic = Math.round(ratio);
			if (nearestHarmonic < 2) continue;
			const relativeError = Math.abs(ratio - nearestHarmonic) / nearestHarmonic;
			if (relativeError <= tolerance) harmonicMatches += 1;
		}
		if (harmonicMatches >= 1) {
			flagged.add(nulls[i].frequency);
		}
	}

	return flagged;
}

/** Bandwidths narrower than this are treated as single raw-FFT-bin glitches. */
export const SINGLE_BIN_BANDWIDTH_OCT = 1 / 48;

export function isSingleBinArtifact(bandwidthOctaves: number): boolean {
	return bandwidthOctaves < SINGLE_BIN_BANDWIDTH_OCT;
}

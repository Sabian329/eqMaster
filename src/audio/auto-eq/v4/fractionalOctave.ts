import { SCALE_FRACTIONS } from "./constants";
import { resampleToGrid } from "./math";
import { smoothFractionalOctave } from "./smoothing";
import { sanitizeRawCurve } from "./validation";
import type { FrequencyPoint, MultiScaleCurves } from "./types";

/**
 * Derives the native 1/24-octave curve plus coarser 1/12, 1/6 and 1/3
 * fractional-octave curves directly from a RAW (single-bin FFT) measurement,
 * then resamples each onto the shared analysis grid. Smoothing each scale
 * independently from RAW (rather than compounding smoothing passes) keeps
 * every scale faithful to the true underlying resolution.
 */
export function deriveMultiScaleFromRaw(
	rawCurve: FrequencyPoint[],
	grid: FrequencyPoint[],
): MultiScaleCurves {
	const raw = sanitizeRawCurve(rawCurve);

	return {
		native1_24: resampleToGrid(
			smoothFractionalOctave(raw, SCALE_FRACTIONS.native),
			grid,
		),
		octave1_12: resampleToGrid(
			smoothFractionalOctave(raw, SCALE_FRACTIONS.fine),
			grid,
		),
		octave1_6: resampleToGrid(
			smoothFractionalOctave(raw, SCALE_FRACTIONS.mid),
			grid,
		),
		octave1_3: resampleToGrid(
			smoothFractionalOctave(raw, SCALE_FRACTIONS.broad),
			grid,
		),
	};
}

/**
 * Re-derives coarser scales from an already-corrected native 1/24 curve that
 * lives on the (uniform log-spaced) analysis grid. Used to refresh residuals
 * after filters are applied, where re-smoothing from RAW is unnecessary.
 */
export function deriveMultiScaleFromGridCurve(
	native1_24OnGrid: FrequencyPoint[],
): MultiScaleCurves {
	return {
		native1_24: native1_24OnGrid,
		octave1_12: smoothFractionalOctave(native1_24OnGrid, SCALE_FRACTIONS.fine),
		octave1_6: smoothFractionalOctave(native1_24OnGrid, SCALE_FRACTIONS.mid),
		octave1_3: smoothFractionalOctave(native1_24OnGrid, SCALE_FRACTIONS.broad),
	};
}

import { DENSE_GRID_SIZE, HEADROOM_DB, PREAMP_WARNING_DB } from "./constants";
import { getCombinedFilterResponseDb } from "./biquadResponse";
import { createLogarithmicGrid } from "./math";
import type {
	AutoEqV3Options,
	AutoEqV3Warning,
	GeneratedEqFilter,
} from "./types";

export function calculatePreampDb(
	filters: GeneratedEqFilter[],
	options: AutoEqV3Options,
): {
	preampDb: number;
	maximumCombinedBoostDb: number;
	maximumCombinedCutDb: number;
	warnings: AutoEqV3Warning[];
} {
	const warnings: AutoEqV3Warning[] = [];

	if (filters.length === 0) {
		return {
			preampDb: 0,
			maximumCombinedBoostDb: 0,
			maximumCombinedCutDb: 0,
			warnings,
		};
	}

	const grid = createLogarithmicGrid(
		options.minFrequency,
		options.maxFrequency,
		DENSE_GRID_SIZE,
	);

	let maximumCombinedBoostDb = 0;
	let maximumCombinedCutDb = 0;

	for (const point of grid) {
		const response = getCombinedFilterResponseDb(
			filters,
			point.frequency,
			options.sampleRate,
		);
		maximumCombinedBoostDb = Math.max(maximumCombinedBoostDb, response);
		maximumCombinedCutDb = Math.min(maximumCombinedCutDb, response);
	}

	const preampDb =
		maximumCombinedBoostDb > 0
			? -(maximumCombinedBoostDb + HEADROOM_DB)
			: 0;

	if (preampDb < PREAMP_WARNING_DB) {
		warnings.push("excessive-required-headroom");
	}

	return {
		preampDb,
		maximumCombinedBoostDb,
		maximumCombinedCutDb,
		warnings,
	};
}

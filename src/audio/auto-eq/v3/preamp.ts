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
	warnings: AutoEqV3Warning[];
} {
	const warnings: AutoEqV3Warning[] = [];
	const grid = createLogarithmicGrid(
		options.minFrequency,
		options.maxFrequency,
		DENSE_GRID_SIZE,
	);

	let maximumCombinedBoostDb = 0;
	for (const point of grid) {
		const boost = getCombinedFilterResponseDb(
			filters,
			point.frequency,
			options.sampleRate,
		);
		maximumCombinedBoostDb = Math.max(maximumCombinedBoostDb, boost);
	}

	const preampDb = -Math.max(0, maximumCombinedBoostDb) - HEADROOM_DB;

	if (preampDb < PREAMP_WARNING_DB) {
		warnings.push("excessive-required-headroom");
	}

	return { preampDb, maximumCombinedBoostDb, warnings };
}

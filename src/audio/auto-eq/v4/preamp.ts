import { HEADROOM_DB, PREAMP_WARNING_DB } from "./constants";
import { getCombinedFilterResponseDb } from "./biquadResponse";
import type { AutoEqV4Options, AutoEqV4Warning, FrequencyPoint, V4GeneratedFilter } from "./types";

export interface V4PreampResult {
	preampDb: number;
	maximumCombinedBoostDb: number;
	maximumCombinedCutDb: number;
	warnings: AutoEqV4Warning[];
}

/** Computes the preamp trim needed so the combined filter response never clips, evaluated on a dense grid. */
export function calculateV4PreampDb(
	filters: V4GeneratedFilter[],
	denseGrid: FrequencyPoint[],
	options: AutoEqV4Options,
): V4PreampResult {
	const warnings: AutoEqV4Warning[] = [];

	if (filters.length === 0) {
		return { preampDb: 0, maximumCombinedBoostDb: 0, maximumCombinedCutDb: 0, warnings };
	}

	let maximumCombinedBoostDb = 0;
	let maximumCombinedCutDb = 0;

	for (const point of denseGrid) {
		const response = getCombinedFilterResponseDb(filters, point.frequency, options.sampleRate);
		maximumCombinedBoostDb = Math.max(maximumCombinedBoostDb, response);
		maximumCombinedCutDb = Math.min(maximumCombinedCutDb, response);
	}

	const preampDb = maximumCombinedBoostDb > 0 ? -(maximumCombinedBoostDb + HEADROOM_DB) : 0;

	if (preampDb < PREAMP_WARNING_DB) {
		warnings.push("excessive-required-headroom");
	}

	return { preampDb, maximumCombinedBoostDb, maximumCombinedCutDb, warnings };
}

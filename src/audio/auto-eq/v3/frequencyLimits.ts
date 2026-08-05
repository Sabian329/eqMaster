import { clamp } from "./math";
import type { EqFilterType } from "./types";

export interface FrequencyLimits {
	maxCutDb: number;
	maxBoostDb: number;
	minQ: number;
	maxCutQ: number;
	maxBoostQ: number;
}

export function getFrequencyLimits(
	frequency: number,
	filterType: EqFilterType = "PK",
): FrequencyLimits {
	if (frequency < 200) {
		return {
			maxCutDb: -15,
			maxBoostDb: filterType === "LS" ? 3 : 3,
			minQ: 0.5,
			maxCutQ: 18,
			maxBoostQ: 2.5,
		};
	}
	if (frequency < 1_000) {
		return {
			maxCutDb: -10,
			maxBoostDb: 2.5,
			minQ: 0.5,
			maxCutQ: 10,
			maxBoostQ: 2.5,
		};
	}
	if (frequency < 5_000) {
		return {
			maxCutDb: -6,
			maxBoostDb: 2,
			minQ: 0.5,
			maxCutQ: 5,
			maxBoostQ: 1.8,
		};
	}
	if (frequency < 10_000) {
		return {
			maxCutDb: -4,
			maxBoostDb: 1.5,
			minQ: 0.5,
			maxCutQ: 3,
			maxBoostQ: 1.4,
		};
	}
	return {
		maxCutDb: -3,
		maxBoostDb: 1,
		minQ: 0.5,
		maxCutQ: 2,
		maxBoostQ: 1,
	};
}

export function clampFilterGain(
	gainDb: number,
	frequency: number,
	filterType: EqFilterType = "PK",
): number {
	const limits = getFrequencyLimits(frequency, filterType);
	if (gainDb < 0) return clamp(gainDb, limits.maxCutDb, -0.01);
	return clamp(gainDb, 0.01, limits.maxBoostDb);
}

export function clampFilterQ(
	q: number,
	frequency: number,
	gainDb: number,
	filterType: EqFilterType = "PK",
	repeatedResonance = false,
): number {
	const limits = getFrequencyLimits(frequency, filterType);
	let maxQ = gainDb < 0 ? limits.maxCutQ : limits.maxBoostQ;

	if (
		repeatedResonance &&
		gainDb < 0 &&
		frequency >= 1_000 &&
		frequency <= 10_000
	) {
		maxQ = Math.max(maxQ, 8);
	}

	return clamp(q, limits.minQ, maxQ);
}

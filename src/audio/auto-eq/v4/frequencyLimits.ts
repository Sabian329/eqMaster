import { clamp } from "./math";
import type { EqFilterType } from "./types";

export interface FrequencyLimits {
	maxCutDb: number;
	maxBoostDb: number;
	minQ: number;
	maxCutQ: number;
	maxBoostQ: number;
	preferredMaxQ: number;
}

export interface FrequencyLimitOptions {
	measurementCount?: number;
	highConfidenceRepeatedResonance?: boolean;
}

function canUseExtendedHighFrequencyLimits(
	frequency: number,
	options: FrequencyLimitOptions,
): boolean {
	return (
		Boolean(options.highConfidenceRepeatedResonance) &&
		(options.measurementCount ?? 1) >= 3 &&
		frequency >= 1_000
	);
}

export function getFrequencyLimits(
	frequency: number,
	filterType: EqFilterType = "PK",
	options: FrequencyLimitOptions = {},
): FrequencyLimits {
	const extendedHf = canUseExtendedHighFrequencyLimits(frequency, options);

	if (frequency < 200) {
		return {
			maxCutDb: -15,
			maxBoostDb: filterType === "LS" ? 3 : 3,
			minQ: 0.5,
			maxCutQ: 20,
			maxBoostQ: 2.5,
			preferredMaxQ: 12,
		};
	}

	if (frequency < 1_000) {
		return {
			maxCutDb: -10,
			maxBoostDb: 2.5,
			minQ: 0.5,
			maxCutQ: 12,
			maxBoostQ: 2.5,
			preferredMaxQ: 7,
		};
	}

	if (frequency < 5_000) {
		return {
			maxCutDb: extendedHf ? -6 : -4,
			maxBoostDb: 1.5,
			minQ: 0.5,
			maxCutQ: 6,
			maxBoostQ: 1.8,
			preferredMaxQ: 3,
		};
	}

	if (frequency < 10_000) {
		return {
			maxCutDb: extendedHf ? -4.5 : -3,
			maxBoostDb: 1,
			minQ: 0.5,
			maxCutQ: 4,
			maxBoostQ: 1.4,
			preferredMaxQ: 2,
		};
	}

	return {
		maxCutDb: extendedHf ? -3 : -2,
		maxBoostDb: 0.5,
		minQ: 0.5,
		maxCutQ: 2.5,
		maxBoostQ: 1,
		preferredMaxQ: 1.4,
	};
}

export function clampFilterGain(
	gainDb: number,
	frequency: number,
	filterType: EqFilterType = "PK",
	options: FrequencyLimitOptions = {},
): number {
	const limits = getFrequencyLimits(frequency, filterType, options);
	if (gainDb < 0) return clamp(gainDb, limits.maxCutDb, -0.01);
	return clamp(gainDb, 0.01, limits.maxBoostDb);
}

export function clampFilterQ(
	q: number,
	frequency: number,
	gainDb: number,
	filterType: EqFilterType = "PK",
	repeatedResonance = false,
	options: FrequencyLimitOptions = {},
): number {
	const limits = getFrequencyLimits(frequency, filterType, {
		...options,
		highConfidenceRepeatedResonance:
			options.highConfidenceRepeatedResonance ?? repeatedResonance,
	});
	const maxQ = gainDb < 0 ? limits.maxCutQ : limits.maxBoostQ;
	return clamp(q, limits.minQ, maxQ);
}

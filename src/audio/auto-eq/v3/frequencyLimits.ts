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
	const measurementCount = options.measurementCount ?? 1;
	const singleMeasurement = measurementCount === 1;
	const extendedHf = canUseExtendedHighFrequencyLimits(frequency, options);

	if (frequency < 200) {
		return {
			maxCutDb: -15,
			maxBoostDb: filterType === "LS" ? 2.5 : 2.5,
			minQ: 0.5,
			maxCutQ: 18,
			maxBoostQ: 2.5,
			preferredMaxQ: 10,
		};
	}

	if (frequency < 1_000) {
		return {
			maxCutDb: singleMeasurement ? -8 : -8,
			maxBoostDb: 2,
			minQ: 0.5,
			maxCutQ: 10,
			maxBoostQ: 2.5,
			preferredMaxQ: 6,
		};
	}

	if (frequency < 5_000) {
		return {
			maxCutDb: extendedHf ? -5 : -3.5,
			maxBoostDb: 1.5,
			minQ: 0.5,
			maxCutQ: extendedHf ? 4 : 4,
			maxBoostQ: 2.5,
			preferredMaxQ: 2.5,
		};
	}

	if (frequency < 10_000) {
		return {
			maxCutDb: extendedHf ? -4 : -2.5,
			maxBoostDb: 1,
			minQ: 0.5,
			maxCutQ: extendedHf ? 2.5 : 2.5,
			maxBoostQ: 1.8,
			preferredMaxQ: 1.8,
		};
	}

	return {
		maxCutDb: extendedHf ? -2.5 : -1.5,
		maxBoostDb: 0.5,
		minQ: 0.5,
		maxCutQ: extendedHf ? 1.8 : 1.8,
		maxBoostQ: 1.2,
		preferredMaxQ: 1.2,
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

import { MIN_CONTRIBUTION_PERCENT, MIN_FILTER_GAIN_DB } from "./constants";
import { calculateTotalCost } from "./costFunction";
import type {
	AutoEqV3Options,
	FrequencyPoint,
	GeneratedEqFilter,
	PreparedMeasurement,
} from "./types";
import { cloneFilter } from "./candidatePool";

export function computeFilterContributionPercent(
	filters: GeneratedEqFilter[],
	filterIndex: number,
	prepared: PreparedMeasurement,
	measurements: FrequencyPoint[][],
	options: AutoEqV3Options,
): number {
	const baseCost = calculateTotalCost(
		prepared,
		measurements,
		filters,
		options,
	).total;
	const without = filters.filter((_, index) => index !== filterIndex);
	const withoutCost = calculateTotalCost(
		prepared,
		measurements,
		without,
		options,
	).total;
	return ((withoutCost - baseCost) / Math.max(baseCost, 1e-6)) * 100;
}

export function updateContributionPercents(
	filters: GeneratedEqFilter[],
	prepared: PreparedMeasurement,
	measurements: FrequencyPoint[][],
	options: AutoEqV3Options,
): GeneratedEqFilter[] {
	return filters.map((filter, index) => ({
		...filter,
		contributionPercent: computeFilterContributionPercent(
			filters,
			index,
			prepared,
			measurements,
			options,
		),
	}));
}

export function pruneFilters(
	filters: GeneratedEqFilter[],
	prepared: PreparedMeasurement,
	measurements: FrequencyPoint[][],
	options: AutoEqV3Options,
): GeneratedEqFilter[] {
	const withContributions = updateContributionPercents(
		filters,
		prepared,
		measurements,
		options,
	);

	return withContributions
		.filter(
			(filter) =>
				Math.abs(filter.gainDb) >= MIN_FILTER_GAIN_DB &&
				filter.contributionPercent >= MIN_CONTRIBUTION_PERCENT,
		)
		.map(cloneFilter);
}

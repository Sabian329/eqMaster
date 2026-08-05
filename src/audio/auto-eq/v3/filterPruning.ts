import { MIN_FILTER_GAIN_DB } from "./constants";
import { cloneFilter } from "./candidatePool";
import { calculateTotalCost, computePredictedCurve } from "./costFunction";
import {
	computeBroadOvercutPenalty,
	smoothToBroad,
} from "./overcut";
import type {
	AutoEqV3Options,
	FrequencyPoint,
	GeneratedEqFilter,
	PreparedMeasurement,
} from "./types";

export const MIN_ABSOLUTE_FILTER_DELTA = 1e-4;
export const MIN_CONTRIBUTION_SHARE = 0.01;

const WEAKEN_FACTORS = [0.75, 0.5, 0.25, 0] as const;

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

function broadOvercutFor(
	filters: GeneratedEqFilter[],
	prepared: PreparedMeasurement,
	options: AutoEqV3Options,
): number {
	const predicted = computePredictedCurve(prepared, filters, options);
	return computeBroadOvercutPenalty(smoothToBroad(predicted), prepared.target);
}

export function updateContributionPercents(
	filters: GeneratedEqFilter[],
	prepared: PreparedMeasurement,
	measurements: FrequencyPoint[][],
	options: AutoEqV3Options,
	initialCost: number,
	finalCost: number,
): GeneratedEqFilter[] {
	const totalAchievedImprovement = Math.max(initialCost - finalCost, 1e-9);

	return filters.map((filter, index) => {
		const without = filters.filter((_, filterIndex) => filterIndex !== index);
		const costWithoutFilter = calculateTotalCost(
			prepared,
			measurements,
			without,
			options,
		).total;
		const filterDelta = costWithoutFilter - finalCost;
		const contributionShare = filterDelta / totalAchievedImprovement;

		return {
			...filter,
			contributionPercent: contributionShare * 100,
		};
	});
}

function chooseWeakenedVariant(
	filters: GeneratedEqFilter[],
	filterIndex: number,
	prepared: PreparedMeasurement,
	measurements: FrequencyPoint[][],
	options: AutoEqV3Options,
): GeneratedEqFilter[] {
	const original = filters[filterIndex];
	const originalCost = calculateTotalCost(
		prepared,
		measurements,
		filters,
		options,
	).total;
	const originalOvercut = broadOvercutFor(filters, prepared, options);

	let best = filters;
	let bestScore = originalCost + originalOvercut;

	for (const factor of WEAKEN_FACTORS) {
		const trial = filters.map(cloneFilter);
		if (factor === 0) {
			trial.splice(filterIndex, 1);
		} else {
			trial[filterIndex].gainDb = original.gainDb * factor;
			if (Math.abs(trial[filterIndex].gainDb) < MIN_FILTER_GAIN_DB) {
				trial.splice(filterIndex, 1);
			}
		}

		const trialCost = calculateTotalCost(
			prepared,
			measurements,
			trial,
			options,
		).total;
		const trialOvercut = broadOvercutFor(trial, prepared, options);
		const score = trialCost + trialOvercut;

		if (score < bestScore - 1e-9) {
			best = trial;
			bestScore = score;
		}
	}

	return best;
}

export function pruneFilters(
	filters: GeneratedEqFilter[],
	prepared: PreparedMeasurement,
	measurements: FrequencyPoint[][],
	options: AutoEqV3Options,
	initialCost?: number,
): { filters: GeneratedEqFilter[]; weakenedFilterCount: number } {
	const finalCost = calculateTotalCost(
		prepared,
		measurements,
		filters,
		options,
	).total;
	const baselineCost =
		initialCost ??
		calculateTotalCost(prepared, measurements, [], options).total;

	let current = updateContributionPercents(
		filters,
		prepared,
		measurements,
		options,
		baselineCost,
		finalCost,
	);
	let weakenedFilterCount = 0;
	let changed = true;

	while (changed) {
		changed = false;
		const workingCost = calculateTotalCost(
			prepared,
			measurements,
			current,
			options,
		).total;
		const withContributions = updateContributionPercents(
			current,
			prepared,
			measurements,
			options,
			baselineCost,
			workingCost,
		);

		for (let index = 0; index < withContributions.length; index += 1) {
			const filter = withContributions[index];
			const without = withContributions.filter(
				(_, filterIndex) => filterIndex !== index,
			);
			const costWithoutFilter = calculateTotalCost(
				prepared,
				measurements,
				without,
				options,
			).total;
			const filterDelta = costWithoutFilter - workingCost;
			const totalAchievedImprovement = Math.max(
				baselineCost - workingCost,
				1e-9,
			);
			const contributionShare = filterDelta / totalAchievedImprovement;

			const shouldRemove =
				Math.abs(filter.gainDb) < MIN_FILTER_GAIN_DB ||
				(contributionShare < MIN_CONTRIBUTION_SHARE &&
					filterDelta < MIN_ABSOLUTE_FILTER_DELTA);

			const overcutBefore = broadOvercutFor(
				withContributions,
				prepared,
				options,
			);
			const overcutWithout = broadOvercutFor(without, prepared, options);
			const causesOvercut =
				overcutBefore > overcutWithout + 0.01 && filter.gainDb < 0;

			if (shouldRemove || causesOvercut || contributionShare < 0.015) {
				const next = chooseWeakenedVariant(
					withContributions,
					index,
					prepared,
					measurements,
					options,
				);
				if (next.length !== withContributions.length) {
					current = next.map(cloneFilter);
					changed = true;
					break;
				}
				if (
					next.length === withContributions.length &&
					Math.abs(next[index].gainDb) < Math.abs(withContributions[index].gainDb) - 1e-6
				) {
					current = next.map(cloneFilter);
					weakenedFilterCount += 1;
					changed = true;
					break;
				}
			}
		}
	}

	return {
		filters: current
			.filter((filter) => Math.abs(filter.gainDb) >= MIN_FILTER_GAIN_DB)
			.map(cloneFilter),
		weakenedFilterCount,
	};
}

import { MIN_CONTRIBUTION_SHARE, MIN_FILTER_GAIN_DB } from "./constants";
import { cloneV4Filter } from "./candidateGeneration";
import { calculateV4TotalCost, computeBroadOvercutPenalty, computePredictedCurve } from "./multiScaleCost";
import { getCombinedFilterResponseDb } from "./biquadResponse";
import type { AutoEqV4Options, PreparedV4Measurement, V4GeneratedFilter } from "./types";

const WEAKEN_FACTORS = [0.75, 0.5, 0.25, 0] as const;
const MIN_ABSOLUTE_FILTER_DELTA = 1e-4;

function broadOvercutFor(
	filters: V4GeneratedFilter[],
	prepared: PreparedV4Measurement,
	options: AutoEqV4Options,
): number {
	const filterResponse = prepared.grid.map((point) =>
		getCombinedFilterResponseDb(filters, point.frequency, options.sampleRate),
	);
	const broadPredicted = computePredictedCurve(prepared.octave1_3, filterResponse);
	return computeBroadOvercutPenalty(broadPredicted, prepared.target);
}

export function updateContributionPercents(
	filters: V4GeneratedFilter[],
	prepared: PreparedV4Measurement,
	options: AutoEqV4Options,
	baselineCost: number,
	finalCost: number,
): V4GeneratedFilter[] {
	const totalAchievedImprovement = Math.max(baselineCost - finalCost, 1e-9);

	return filters.map((filter, index) => {
		const without = filters.filter((_, filterIndex) => filterIndex !== index);
		const costWithoutFilter = calculateV4TotalCost(prepared, without, options).total;
		const filterDelta = costWithoutFilter - finalCost;
		return { ...filter, contributionPercent: (filterDelta / totalAchievedImprovement) * 100 };
	});
}

function chooseWeakenedVariant(
	filters: V4GeneratedFilter[],
	filterIndex: number,
	prepared: PreparedV4Measurement,
	options: AutoEqV4Options,
): V4GeneratedFilter[] {
	const original = filters[filterIndex];
	const originalCost = calculateV4TotalCost(prepared, filters, options).total;
	const originalOvercut = broadOvercutFor(filters, prepared, options);

	let best = filters;
	let bestScore = originalCost + originalOvercut;

	for (const factor of WEAKEN_FACTORS) {
		const trial = filters.map(cloneV4Filter);
		if (factor === 0) {
			trial.splice(filterIndex, 1);
		} else {
			trial[filterIndex].gainDb = original.gainDb * factor;
			if (Math.abs(trial[filterIndex].gainDb) < MIN_FILTER_GAIN_DB) trial.splice(filterIndex, 1);
		}

		const trialCost = calculateV4TotalCost(prepared, trial, options).total;
		const trialOvercut = broadOvercutFor(trial, prepared, options);
		const score = trialCost + trialOvercut;

		if (score < bestScore - 1e-9) {
			best = trial;
			bestScore = score;
		}
	}

	return best;
}

/**
 * Removes/weakens filters whose marginal cost contribution is negligible or
 * that make the broad (1/3 octave) cut limit worse than removing them would.
 */
export function pruneV4Filters(
	filters: V4GeneratedFilter[],
	prepared: PreparedV4Measurement,
	options: AutoEqV4Options,
	baselineCost: number,
): { filters: V4GeneratedFilter[]; weakenedFilterCount: number } {
	let current = filters.map(cloneV4Filter);
	let weakenedFilterCount = 0;
	let changed = true;

	while (changed) {
		changed = false;
		const workingCost = calculateV4TotalCost(prepared, current, options).total;
		const withContributions = updateContributionPercents(current, prepared, options, baselineCost, workingCost);

		for (let index = 0; index < withContributions.length; index += 1) {
			const filter = withContributions[index];
			const without = withContributions.filter((_, filterIndex) => filterIndex !== index);
			const costWithoutFilter = calculateV4TotalCost(prepared, without, options).total;
			const filterDelta = costWithoutFilter - workingCost;
			const totalAchievedImprovement = Math.max(baselineCost - workingCost, 1e-9);
			const contributionShare = filterDelta / totalAchievedImprovement;

			const shouldRemove =
				Math.abs(filter.gainDb) < MIN_FILTER_GAIN_DB ||
				(contributionShare < MIN_CONTRIBUTION_SHARE && filterDelta < MIN_ABSOLUTE_FILTER_DELTA);

			const overcutBefore = broadOvercutFor(withContributions, prepared, options);
			const overcutWithout = broadOvercutFor(without, prepared, options);
			const causesOvercut = overcutBefore > overcutWithout + 0.01 && filter.gainDb < 0;

			if (shouldRemove || causesOvercut || contributionShare < MIN_CONTRIBUTION_SHARE) {
				const next = chooseWeakenedVariant(withContributions, index, prepared, options);
				if (next.length !== withContributions.length) {
					current = next.map(cloneV4Filter);
					changed = true;
					break;
				}
				if (
					next.length === withContributions.length &&
					Math.abs(next[index].gainDb) < Math.abs(withContributions[index].gainDb) - 1e-6
				) {
					current = next.map(cloneV4Filter);
					weakenedFilterCount += 1;
					changed = true;
					break;
				}
			}
		}
	}

	return {
		filters: current.filter((filter) => Math.abs(filter.gainDb) >= MIN_FILTER_GAIN_DB).map(cloneV4Filter),
		weakenedFilterCount,
	};
}

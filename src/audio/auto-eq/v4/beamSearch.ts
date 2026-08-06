import { getV4SearchBudget, MIN_FILTER_GAIN_DB } from "./constants";
import {
	acceptsV4CandidateEvaluation,
	evaluateV4CandidateAddition,
} from "./candidateEvaluation";
import { buildV4CandidatePools, candidateToFilter } from "./candidateGeneration";
import { getV4MinimumImprovementPercent } from "./correctionStrength";
import { calculateV4TotalCost } from "./multiScaleCost";
import { refreshResiduals } from "./prepareMeasurement";
import { detectResonances } from "./resonanceDetection";
import { detectShelves, detectTonalOnly } from "./shelfDetection";
import type {
	AutoEqV4Options,
	AutoEqV4Progress,
	AutoEqV4StopReason,
	PreparedV4Measurement,
	V4GeneratedFilter,
} from "./types";

export type V4ProgressCallback = (progress: AutoEqV4Progress) => void;

interface BeamState {
	filters: V4GeneratedFilter[];
	cost: number;
}

function generateBranches(
	state: BeamState,
	prepared: PreparedV4Measurement,
	options: AutoEqV4Options,
	branchingFactor: number,
): V4GeneratedFilter[] {
	const working = refreshResiduals(prepared, state.filters, options);
	const resonances = detectResonances(working);
	const tonalRegions = detectTonalOnly(working);
	const shelves = detectShelves(working);
	const pools = buildV4CandidatePools(working, options, resonances, tonalRegions, shelves);

	const candidates = pools.all.filter((candidate) => {
		if (Math.abs(candidate.gainDb) < MIN_FILTER_GAIN_DB) return false;
		return !state.filters.some(
			(existing) =>
				existing.type === candidate.type &&
				Math.abs(Math.log2(existing.frequency / candidate.frequency)) < 1 / 24,
		);
	});

	const evaluated = candidates
		.map((candidate) => candidateToFilter(candidate))
		.map((filter) => ({
			filter,
			evaluation: evaluateV4CandidateAddition(prepared, state.filters, filter, options),
		}))
		.filter(({ filter, evaluation }) =>
			acceptsV4CandidateEvaluation(evaluation, {
				frequency: filter.frequency,
				reason: filter.reason,
			}),
		)
		.sort((a, b) => b.evaluation.globalImprovement - a.evaluation.globalImprovement);

	return evaluated.slice(0, branchingFactor).map((entry) => entry.filter);
}

export interface BeamSearchResult {
	filters: V4GeneratedFilter[];
	stopReason: AutoEqV4StopReason;
	iterations: number;
	bestCost: number;
}

/**
 * Beam search over filter sets: at each step, every surviving hypothesis
 * branches into up to BEAM_BRANCHING candidate additions, and only the
 * BEAM_WIDTH lowest-cost resulting filter sets survive to the next step.
 */
export function beamSearch(
	prepared: PreparedV4Measurement,
	options: AutoEqV4Options,
	onProgress?: V4ProgressCallback,
): BeamSearchResult {
	const budget = getV4SearchBudget(options.precisionMode);
	let beam: BeamState[] = [
		{ filters: [], cost: calculateV4TotalCost(prepared, [], options).total },
	];
	let stopReason: AutoEqV4StopReason = "beam-search-converged";
	let iterations = 0;

	for (let iteration = 0; iteration < options.maxFilters; iteration += 1) {
		iterations = iteration + 1;
		onProgress?.({
			stage: "beam-search",
			progress: 0.25 + (iteration / options.maxFilters) * 0.3,
			iteration,
			filterCount: beam[0]?.filters.length ?? 0,
			currentFilterCount: beam[0]?.filters.length ?? 0,
			currentCost: beam[0]?.cost,
			beamSize: beam.length,
		});

		const nextCandidates: BeamState[] = [];
		for (const state of beam) {
			if (state.filters.length >= options.maxFilters) {
				nextCandidates.push(state);
				continue;
			}

			const branches = generateBranches(
				state,
				prepared,
				options,
				budget.beamBranching,
			);
			if (branches.length === 0) {
				nextCandidates.push(state);
				continue;
			}

			for (const filter of branches) {
				const filters = [...state.filters, filter];
				nextCandidates.push({
					filters,
					cost: calculateV4TotalCost(prepared, filters, options).total,
				});
			}
		}

		nextCandidates.sort((a, b) => a.cost - b.cost);
		const nextBeam = nextCandidates.slice(0, budget.beamWidth);

		const bestBefore = beam[0]?.cost ?? Number.POSITIVE_INFINITY;
		const bestAfter = nextBeam[0]?.cost ?? bestBefore;
		const filterCount = nextBeam[0]?.filters.length ?? 0;
		const relativeImprovement =
			(bestBefore - bestAfter) / Math.max(Math.abs(bestBefore), 1e-9);
		const minImprovement = getV4MinimumImprovementPercent(filterCount);

		if (nextBeam.length === 0 || bestAfter >= bestBefore - 1e-6) {
			stopReason =
				(beam[0]?.filters.length ?? 0) >= options.maxFilters
					? "max-filters-reached"
					: "improvement-below-threshold";
			break;
		}

		if (relativeImprovement < minImprovement && filterCount >= 4) {
			beam = nextBeam;
			stopReason = "improvement-below-threshold";
			break;
		}

		beam = nextBeam;
	}

	const best = beam.reduce((a, b) => (a.cost <= b.cost ? a : b));
	if (best.filters.length >= options.maxFilters) stopReason = "max-filters-reached";
	if (best.filters.length === 0) stopReason = "no-valid-candidates";

	return {
		filters: best.filters,
		stopReason,
		iterations,
		bestCost: best.cost,
	};
}

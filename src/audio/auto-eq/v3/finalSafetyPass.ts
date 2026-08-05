import { getFilterResponseDb } from "./biquadResponse";
import { cloneFilter } from "./candidatePool";
import { calculateTotalCost, computePredictedCurve } from "./costFunction";
import {
	getAllowedBroadUndershootDb,
	smoothToBroad,
} from "./overcut";
import type {
	AutoEqV3Options,
	FrequencyPoint,
	GeneratedEqFilter,
	PreparedMeasurement,
} from "./types";

const MAX_SAFETY_ITERATIONS = 20;
const MIN_OVERCUT_OCTAVES = 0.4;
const GAIN_STEP_DB = 0.25;

interface OvercutRegion {
	fromIndex: number;
	toIndex: number;
	fromHz: number;
	toHz: number;
	severityDb: number;
}

function findBroadOvercutRegions(
	broadPredicted: FrequencyPoint[],
	target: FrequencyPoint[],
): OvercutRegion[] {
	const regions: OvercutRegion[] = [];
	let start: number | null = null;
	let severity = 0;

	const flush = (endExclusive: number) => {
		if (start === null) return;
		const fromHz = broadPredicted[start].frequency;
		const toHz = broadPredicted[endExclusive - 1].frequency;
		const widthOctaves = Math.abs(Math.log2(toHz / fromHz));
		if (widthOctaves >= MIN_OVERCUT_OCTAVES && endExclusive - start >= 3) {
			regions.push({
				fromIndex: start,
				toIndex: endExclusive - 1,
				fromHz,
				toHz,
				severityDb: severity / Math.max(endExclusive - start, 1),
			});
		}
		start = null;
		severity = 0;
	};

	for (let index = 0; index < broadPredicted.length; index += 1) {
		const frequency = broadPredicted[index].frequency;
		// Safety pass protects high-frequency tonal balance; bass resonances are handled elsewhere.
		if (frequency < 1_000) {
			flush(index);
			continue;
		}
		const allowed = getAllowedBroadUndershootDb(frequency);
		const undershoot =
			target[index].db - allowed - broadPredicted[index].db;

		if (undershoot > 0) {
			if (start === null) start = index;
			severity += undershoot;
		} else {
			flush(index);
		}
	}
	flush(broadPredicted.length);

	return regions;
}

function filterContributionInRegion(
	filter: GeneratedEqFilter,
	region: OvercutRegion,
	grid: FrequencyPoint[],
	sampleRate: number,
): number {
	let contribution = 0;
	for (let index = region.fromIndex; index <= region.toIndex; index += 1) {
		const response = getFilterResponseDb(
			{
				type: filter.type,
				frequency: filter.frequency,
				gainDb: filter.gainDb,
				q: filter.q,
			},
			grid[index].frequency,
			sampleRate,
		);
		if (response < 0) contribution += -response;
	}
	return contribution;
}

function weakenFilterGain(
	filter: GeneratedEqFilter,
	amountDb: number,
): GeneratedEqFilter {
	const clone = cloneFilter(filter);
	if (clone.gainDb < 0) {
		clone.gainDb = Math.min(0, clone.gainDb + amountDb);
	} else if (clone.gainDb > 0) {
		clone.gainDb = Math.max(0, clone.gainDb - amountDb);
	}
	clone.weakenedBySafetyPass = true;
	return clone;
}

export interface FinalSafetyPassResult {
	filters: GeneratedEqFilter[];
	weakenedFilterCount: number;
	iterations: number;
}

export function runFinalSafetyPass(
	filters: GeneratedEqFilter[],
	prepared: PreparedMeasurement,
	measurements: FrequencyPoint[][],
	options: AutoEqV3Options,
): FinalSafetyPassResult {
	let current = filters.map(cloneFilter);
	let weakenedFilterCount = 0;
	let iterations = 0;

	for (; iterations < MAX_SAFETY_ITERATIONS; iterations += 1) {
		const predicted = computePredictedCurve(prepared, current, options);
		const broadPredicted = smoothToBroad(predicted);
		const regions = findBroadOvercutRegions(broadPredicted, prepared.target);
		if (regions.length === 0) break;

		regions.sort((a, b) => b.severityDb - a.severityDb);
		const region = regions[0];

		const ranked = current
			.map((filter, index) => ({
				index,
				filter,
				contribution: filterContributionInRegion(
					filter,
					region,
					prepared.detailed,
					options.sampleRate,
				),
			}))
			.filter(
				(entry) =>
					entry.contribution > 0.05 &&
					entry.filter.gainDb < 0 &&
					entry.filter.frequency >= 1_000,
			)
			.sort((a, b) => b.contribution - a.contribution);

		if (ranked.length === 0) break;

		const targetIndex = ranked[0].index;
		const beforeCost = calculateTotalCost(
			prepared,
			measurements,
			current,
			options,
		).total;

		let best = current;
		let bestCost = beforeCost;
		let improved = false;

		for (let step = 1; step <= 8; step += 1) {
			const trial = current.map(cloneFilter);
			trial[targetIndex] = weakenFilterGain(
				trial[targetIndex],
				GAIN_STEP_DB * step,
			);

			if (Math.abs(trial[targetIndex].gainDb) < 0.15) {
				trial.splice(targetIndex, 1);
			}

			const trialPredicted = computePredictedCurve(prepared, trial, options);
			const trialBroad = smoothToBroad(trialPredicted);
			const trialRegions = findBroadOvercutRegions(
				trialBroad,
				prepared.target,
			);
			const trialCost = calculateTotalCost(
				prepared,
				measurements,
				trial,
				options,
			).total;

			const regionImproved =
				trialRegions.every((item) => item.severityDb <= region.severityDb) ||
				trialRegions.length < regions.length;

			if (regionImproved && trialCost <= beforeCost * 1.05) {
				best = trial;
				bestCost = trialCost;
				improved = true;
				break;
			}

			if (trialCost < bestCost && regionImproved) {
				best = trial;
				bestCost = trialCost;
				improved = true;
			}
		}

		if (!improved) break;

		const beforeId = current[targetIndex]?.id;
		current = best;
		if (
			!current.some((filter) => filter.id === beforeId) ||
			current.some(
				(filter) => filter.id === beforeId && filter.weakenedBySafetyPass,
			)
		) {
			weakenedFilterCount += 1;
		}
	}

	return {
		filters: current,
		weakenedFilterCount,
		iterations,
	};
}

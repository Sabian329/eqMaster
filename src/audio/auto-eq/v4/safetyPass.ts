import { MAX_SAFETY_PASS_ITERATIONS } from "./constants";
import { getFilterResponseDb } from "./biquadResponse";
import { cloneV4Filter } from "./candidateGeneration";
import { calculateV4TotalCost, getAllowedBroadUndershootDb } from "./multiScaleCost";
import type { AutoEqV4Options, FrequencyPoint, PreparedV4Measurement, V4GeneratedFilter } from "./types";

const MAX_SAFETY_ITERATIONS = MAX_SAFETY_PASS_ITERATIONS;
const MIN_OVERCUT_OCTAVES = 0.4;
const GAIN_STEP_DB = 0.25;

interface OvercutRegion {
	fromIndex: number;
	toIndex: number;
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
				severityDb: severity / Math.max(endExclusive - start, 1),
			});
		}
		start = null;
		severity = 0;
	};

	for (let index = 0; index < broadPredicted.length; index += 1) {
		const frequency = broadPredicted[index].frequency;
		if (frequency < 1_000) {
			flush(index);
			continue;
		}
		const allowed = getAllowedBroadUndershootDb(frequency);
		const undershoot = target[index].db - allowed - broadPredicted[index].db;

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
	filter: V4GeneratedFilter,
	region: OvercutRegion,
	grid: FrequencyPoint[],
	sampleRate: number,
): number {
	let contribution = 0;
	for (let index = region.fromIndex; index <= region.toIndex; index += 1) {
		const response = getFilterResponseDb(filter, grid[index].frequency, sampleRate);
		if (response < 0) contribution += -response;
	}
	return contribution;
}

function weakenFilterGain(filter: V4GeneratedFilter, amountDb: number): V4GeneratedFilter {
	const clone = cloneV4Filter(filter);
	if (clone.gainDb < 0) clone.gainDb = Math.min(0, clone.gainDb + amountDb);
	else if (clone.gainDb > 0) clone.gainDb = Math.max(0, clone.gainDb - amountDb);
	clone.weakenedBySafetyPass = true;
	return clone;
}

export interface V4SafetyPassResult {
	filters: V4GeneratedFilter[];
	weakenedFilterCount: number;
}

/**
 * Weakens filters that drive the broad (1/3-octave) predicted response below
 * target by more than the allowed undershoot at high frequencies, protecting
 * overall tonal balance from overly aggressive narrow-band HF cuts.
 */
export function runV4SafetyPass(
	filters: V4GeneratedFilter[],
	prepared: PreparedV4Measurement,
	options: AutoEqV4Options,
): V4SafetyPassResult {
	let current = filters.map(cloneV4Filter);
	let weakenedFilterCount = 0;

	for (let iteration = 0; iteration < MAX_SAFETY_ITERATIONS; iteration += 1) {
		const filterResponse = prepared.grid.map((point) => {
			let total = 0;
			for (const filter of current) {
				if (!filter.enabled || Math.abs(filter.gainDb) < 0.01) continue;
				total += getFilterResponseDb(filter, point.frequency, options.sampleRate);
			}
			return total;
		});
		const broadPredicted = prepared.octave1_3.map((point, index) => ({
			frequency: point.frequency,
			db: point.db + filterResponse[index],
		}));
		const regions = findBroadOvercutRegions(broadPredicted, prepared.target);
		if (regions.length === 0) break;

		regions.sort((a, b) => b.severityDb - a.severityDb);
		const region = regions[0];

		const ranked = current
			.map((filter, index) => ({
				index,
				filter,
				contribution: filterContributionInRegion(filter, region, prepared.grid, options.sampleRate),
			}))
			.filter((entry) => entry.contribution > 0.05 && entry.filter.gainDb < 0 && entry.filter.frequency >= 1_000)
			.sort((a, b) => b.contribution - a.contribution);

		if (ranked.length === 0) break;

		const targetIndex = ranked[0].index;
		const beforeCost = calculateV4TotalCost(prepared, current, options).total;
		let best = current;
		let improved = false;

		for (let step = 1; step <= 8; step += 1) {
			const trial = current.map(cloneV4Filter);
			trial[targetIndex] = weakenFilterGain(trial[targetIndex], GAIN_STEP_DB * step);
			if (Math.abs(trial[targetIndex].gainDb) < 0.15) trial.splice(targetIndex, 1);

			const trialFilterResponse = prepared.grid.map((point) => {
				let total = 0;
				for (const filter of trial) {
					if (!filter.enabled || Math.abs(filter.gainDb) < 0.01) continue;
					total += getFilterResponseDb(filter, point.frequency, options.sampleRate);
				}
				return total;
			});
			const trialBroad = prepared.octave1_3.map((point, index) => ({
				frequency: point.frequency,
				db: point.db + trialFilterResponse[index],
			}));
			const trialRegions = findBroadOvercutRegions(trialBroad, prepared.target);
			const trialCost = calculateV4TotalCost(prepared, trial, options).total;

			const regionImproved =
				trialRegions.every((item) => item.severityDb <= region.severityDb) || trialRegions.length < regions.length;

			if (regionImproved && trialCost <= beforeCost * 1.05) {
				best = trial;
				improved = true;
				break;
			}
		}

		if (!improved) break;

		const beforeId = current[targetIndex]?.id;
		current = best;
		if (
			!current.some((filter) => filter.id === beforeId) ||
			current.some((filter) => filter.id === beforeId && filter.weakenedBySafetyPass)
		) {
			weakenedFilterCount += 1;
		}
	}

	return { filters: current, weakenedFilterCount };
}

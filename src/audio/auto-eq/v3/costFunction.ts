import {
	BOOST_PENALTY_COEFFICIENT,
	CANCELLATION_DISTANCE_OCTAVES,
	COST_ERROR_CLAMP_DB,
	HUBER_DELTA,
	MEDIAN_WORST_SPLIT,
	OVERLAP_DISTANCE_OCTAVES,
} from "./constants";
import { getCombinedFilterResponseDb } from "./biquadResponse";
import {
	buildAnalysisPoint,
	getCorrectabilityWeight,
} from "./correctability";
import {
	getHighQPenaltyWeight,
	getPreferredMaximumQ,
} from "./correctionStrength";
import { clamp, frequencyWeight, huber, resampleToGrid } from "./math";
import {
	computeBroadCutLimitPenalty,
	computeBroadOvercutPenalty,
	smoothToBroad,
} from "./overcut";
import { applyTolerance, getTargetToleranceDb } from "./tolerance";
import type {
	AutoEqV3Options,
	CostBreakdown,
	FrequencyPoint,
	GeneratedEqFilter,
	PreparedMeasurement,
} from "./types";

function asymmetricError(errorDb: number, frequency: number): number {
	if (frequency < 1_000) return errorDb;
	// Prefer slight excess over broad undershoot above 1 kHz.
	if (errorDb < 0) return errorDb * 1.35;
	return errorDb * 0.85;
}

function measurementCost(
	measured: FrequencyPoint[],
	target: FrequencyPoint[],
	filterResponse: number[],
	reliability: Float64Array,
	options: AutoEqV3Options,
	prepared: PreparedMeasurement,
): number {
	let totalLoss = 0;
	let totalWeight = 0;

	for (let index = 0; index < measured.length; index += 1) {
		const frequency = measured[index].frequency;
		if (frequency < options.minFrequency || frequency > options.maxFrequency)
			continue;

		const predictedDb = measured[index].db + filterResponse[index];
		const rawError = predictedDb - target[index].db;
		const limitedError = clamp(
			rawError,
			-COST_ERROR_CLAMP_DB,
			COST_ERROR_CLAMP_DB,
		);
		const toleratedError = applyTolerance(
			limitedError,
			getTargetToleranceDb(frequency),
		);
		const shapedError = asymmetricError(toleratedError, frequency);

		const analysis = buildAnalysisPoint({
			frequency,
			errorDb: rawError,
			reliability: reliability[index],
			boostAllowed:
				options.allowBoosts &&
				frequency >= prepared.usableBoostRange.fromHz &&
				frequency <= prepared.usableBoostRange.toHz,
			usableFromHz: prepared.usableBoostRange.fromHz,
			usableToHz: prepared.usableBoostRange.toHz,
		});

		const correctabilityWeight = getCorrectabilityWeight(analysis);
		const pointWeight =
			frequencyWeight(frequency) *
			reliability[index] *
			correctabilityWeight;

		totalLoss += huber(shapedError, HUBER_DELTA) * pointWeight;
		totalWeight += pointWeight;
	}

	return totalLoss / Math.max(totalWeight, 1);
}

function computeFilterResponseArray(
	filters: GeneratedEqFilter[],
	grid: FrequencyPoint[],
	sampleRate: number,
): number[] {
	return grid.map((point) =>
		getCombinedFilterResponseDb(filters, point.frequency, sampleRate),
	);
}

function boostPenalty(
	filters: GeneratedEqFilter[],
	measurementCount: number,
): number {
	let penalty = 0;
	for (const filter of filters) {
		if (filter.gainDb <= 0) continue;
		let coefficient = BOOST_PENALTY_COEFFICIENT * 3;
		if (measurementCount === 1 && filter.frequency >= 1_000) {
			coefficient *= 1.5;
		}
		penalty += coefficient * filter.gainDb * filter.gainDb;
	}
	return penalty;
}

function highQPenalty(
	filters: GeneratedEqFilter[],
	measurementCount: number,
): number {
	let penalty = 0;
	for (const filter of filters) {
		const preferred = getPreferredMaximumQ(filter.frequency);
		const excessiveQ = Math.max(0, filter.q - preferred);
		penalty +=
			excessiveQ *
			excessiveQ *
			getHighQPenaltyWeight(filter.frequency, measurementCount);
	}
	return penalty;
}

function overlapPenalty(filters: GeneratedEqFilter[]): number {
	let penalty = 0;
	for (let left = 0; left < filters.length; left += 1) {
		for (let right = left + 1; right < filters.length; right += 1) {
			const distance = Math.abs(
				Math.log2(filters[left].frequency / filters[right].frequency),
			);
			const bothCuts =
				filters[left].gainDb < 0 && filters[right].gainDb < 0;
			const bothAbove1k =
				filters[left].frequency >= 1_000 &&
				filters[right].frequency >= 1_000;

			if (distance < OVERLAP_DISTANCE_OCTAVES) {
				penalty += 0.08;
			}

			if (bothCuts && bothAbove1k && distance < 0.75) {
				const gainSum =
					Math.abs(filters[left].gainDb) + Math.abs(filters[right].gainDb);
				const correlationProxy = Math.max(0, 1 - distance / 0.75);
				if (correlationProxy > 0.8) {
					let multiplier = 0.35;
					if (
						filters[left].frequency >= 5_000 &&
						filters[right].frequency >= 5_000
					) {
						multiplier = 0.7;
					}
					penalty +=
						multiplier *
						correlationProxy *
						gainSum *
						Math.max(0.1, 0.75 - distance);
				}
			}
		}
	}
	return penalty;
}

function cancellationPenalty(filters: GeneratedEqFilter[]): number {
	let penalty = 0;
	for (let left = 0; left < filters.length; left += 1) {
		for (let right = left + 1; right < filters.length; right += 1) {
			const distance = Math.abs(
				Math.log2(filters[left].frequency / filters[right].frequency),
			);
			if (distance >= CANCELLATION_DISTANCE_OCTAVES) continue;
			if (Math.sign(filters[left].gainDb) === Math.sign(filters[right].gainDb))
				continue;
			penalty += 0.12;
		}
	}
	return penalty;
}

function headroomPenalty(
	filters: GeneratedEqFilter[],
	grid: FrequencyPoint[],
	sampleRate: number,
): number {
	let maxBoost = 0;
	for (const point of grid) {
		const boost = getCombinedFilterResponseDb(
			filters,
			point.frequency,
			sampleRate,
		);
		maxBoost = Math.max(maxBoost, boost);
	}
	return maxBoost > 6 ? 0.05 * (maxBoost - 6) ** 2 : 0;
}

function filterCountPenalty(
	filters: GeneratedEqFilter[],
	maxFilters: number,
): number {
	return 0.004 * (filters.length / Math.max(maxFilters, 1));
}

function offBandDamagePenalty(filters: GeneratedEqFilter[]): number {
	let penalty = 0;
	for (const filter of filters) {
		if (typeof filter.offBandDamage === "number" && filter.offBandDamage > 0) {
			penalty += filter.offBandDamage * 0.5;
		}
	}
	return penalty;
}

export function calculateTotalCost(
	prepared: PreparedMeasurement,
	measurements: FrequencyPoint[][],
	filters: GeneratedEqFilter[],
	options: AutoEqV3Options,
): CostBreakdown {
	const grid = prepared.simGrid;
	const filterResponse = computeFilterResponseArray(
		filters,
		grid,
		options.sampleRate,
	);
	const simTarget = resampleToGrid(prepared.target, grid);
	const simReliability = new Float64Array(
		grid.map((point) => {
			const index = prepared.detailed.findIndex(
				(detailedPoint) =>
					Math.abs(Math.log2(detailedPoint.frequency / point.frequency)) <
					1 / 96,
			);
			return index >= 0 ? prepared.reliability[index] : 1;
		}),
	);

	const medianGrid = prepared.detailed;
	const medianResponse = computeFilterResponseArray(
		filters,
		medianGrid,
		options.sampleRate,
	);

	const medianCost = measurementCost(
		medianGrid,
		prepared.target,
		medianResponse,
		prepared.reliability,
		options,
		prepared,
	);

	const perMeasurementCosts = measurements.map((measurement) => {
		const aligned = resampleToGrid(measurement, grid);
		return measurementCost(
			aligned,
			simTarget,
			filterResponse,
			simReliability,
			options,
			prepared,
		);
	});

	const worstCost = Math.max(...perMeasurementCosts, medianCost);
	const responseCost =
		MEDIAN_WORST_SPLIT.median * medianCost +
		MEDIAN_WORST_SPLIT.worst * worstCost;

	const boost = boostPenalty(filters, prepared.measurementCount);
	const overlap = overlapPenalty(filters);
	const cancellation = cancellationPenalty(filters);
	const highQ = highQPenalty(filters, prepared.measurementCount);
	const headroom = headroomPenalty(filters, grid, options.sampleRate);
	const filterCount = filterCountPenalty(filters, options.maxFilters);
	const offBand = offBandDamagePenalty(filters);

	// Evaluate broad penalties on a decimated grid to keep optimizer iterations fast.
	const decimation = 4;
	const combinedFilterCurve: FrequencyPoint[] = [];
	const predictedCurve: FrequencyPoint[] = [];
	const decimatedTarget: FrequencyPoint[] = [];
	for (let index = 0; index < medianGrid.length; index += decimation) {
		combinedFilterCurve.push({
			frequency: medianGrid[index].frequency,
			db: medianResponse[index],
		});
		predictedCurve.push({
			frequency: medianGrid[index].frequency,
			db: medianGrid[index].db + medianResponse[index],
		});
		decimatedTarget.push(prepared.target[index]);
	}
	const broadPredicted = smoothToBroad(predictedCurve);
	const broadCombined = smoothToBroad(combinedFilterCurve);
	const broadOvercut = computeBroadOvercutPenalty(
		broadPredicted,
		decimatedTarget,
	);
	const broadCutLimit = computeBroadCutLimitPenalty(broadCombined);

	const total =
		responseCost +
		boost +
		highQ +
		overlap +
		cancellation +
		headroom +
		filterCount +
		offBand +
		broadOvercut +
		broadCutLimit;

	return {
		total,
		medianMeasurementCost: medianCost,
		worstMeasurementCost: worstCost,
		responseCost,
		boostPenalty: boost,
		overlapPenalty: overlap,
		cancellationPenalty: cancellation,
		qPenalty: highQ,
		highQPenalty: highQ,
		headroomPenalty: headroom,
		filterCountPenalty: filterCount,
		offBandDamagePenalty: offBand,
		broadOvercutPenalty: broadOvercut,
		broadCutLimitPenalty: broadCutLimit,
	};
}

export function computeCombinedFilterResponse(
	filters: GeneratedEqFilter[],
	grid: FrequencyPoint[],
	sampleRate: number,
): FrequencyPoint[] {
	return grid.map((point) => ({
		frequency: point.frequency,
		db: getCombinedFilterResponseDb(filters, point.frequency, sampleRate),
	}));
}

export function computePredictedCurve(
	prepared: PreparedMeasurement,
	filters: GeneratedEqFilter[],
	options: AutoEqV3Options,
): FrequencyPoint[] {
	return prepared.detailed.map((point) => ({
		frequency: point.frequency,
		db:
			point.db +
			getCombinedFilterResponseDb(filters, point.frequency, options.sampleRate),
	}));
}

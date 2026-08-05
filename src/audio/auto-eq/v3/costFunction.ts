import {
  BOOST_PENALTY_COEFFICIENT,
  CANCELLATION_DISTANCE_OCTAVES,
  COST_ERROR_CLAMP_DB,
  HUBER_DELTA,
  MEDIAN_WORST_SPLIT,
  OVERLAP_DISTANCE_OCTAVES,
} from './constants';
import { getCombinedFilterResponseDb } from './biquadResponse';
import { clamp, frequencyWeight, huber, resampleToGrid } from './math';
import type {
  AutoEqV3Options,
  CostBreakdown,
  FrequencyPoint,
  GeneratedEqFilter,
  PreparedMeasurement,
} from './types';

function measurementCost(
  measured: FrequencyPoint[],
  target: FrequencyPoint[],
  filterResponse: number[],
  reliability: Float64Array,
  options: AutoEqV3Options,
): number {
  let totalLoss = 0;
  let totalWeight = 0;

  for (let index = 0; index < measured.length; index += 1) {
    const frequency = measured[index].frequency;
    if (frequency < options.minFrequency || frequency > options.maxFrequency) continue;

    const predictedDb = measured[index].db + filterResponse[index];
    const rawError = predictedDb - target[index].db;
    const limitedError = clamp(rawError, -COST_ERROR_CLAMP_DB, COST_ERROR_CLAMP_DB);
    const weight = frequencyWeight(frequency) * reliability[index];

    totalLoss += huber(limitedError, HUBER_DELTA) * weight;
    totalWeight += weight;
  }

  return totalLoss / Math.max(totalWeight, 1);
}

function computeFilterResponseArray(
  filters: GeneratedEqFilter[],
  grid: FrequencyPoint[],
  sampleRate: number,
): number[] {
  return grid.map((point) => getCombinedFilterResponseDb(filters, point.frequency, sampleRate));
}

function boostPenalty(filters: GeneratedEqFilter[]): number {
  let penalty = 0;
  for (const filter of filters) {
    if (filter.gainDb > 0) {
      penalty += BOOST_PENALTY_COEFFICIENT * filter.gainDb * filter.gainDb;
    }
  }
  return penalty;
}

function qPenalty(filters: GeneratedEqFilter[]): number {
  let penalty = 0;
  for (const filter of filters) {
    if (filter.q > 4) {
      penalty += 0.01 * (filter.q - 4) ** 2;
    }
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
      if (distance < OVERLAP_DISTANCE_OCTAVES) {
        penalty += 0.08;
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
      if (Math.sign(filters[left].gainDb) === Math.sign(filters[right].gainDb)) continue;
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
    const boost = getCombinedFilterResponseDb(filters, point.frequency, sampleRate);
    maxBoost = Math.max(maxBoost, boost);
  }
  return maxBoost > 6 ? 0.05 * (maxBoost - 6) ** 2 : 0;
}

function filterCountPenalty(filters: GeneratedEqFilter[], maxFilters: number): number {
  return 0.004 * (filters.length / Math.max(maxFilters, 1));
}

export function calculateTotalCost(
  prepared: PreparedMeasurement,
  measurements: FrequencyPoint[][],
  filters: GeneratedEqFilter[],
  options: AutoEqV3Options,
): CostBreakdown {
  const grid = prepared.simGrid;
  const filterResponse = computeFilterResponseArray(filters, grid, options.sampleRate);
  const simTarget = resampleToGrid(prepared.target, grid);
  const simReliability = new Float64Array(
    grid.map((point) => {
      const index = prepared.detailed.findIndex(
        (detailedPoint) =>
          Math.abs(Math.log2(detailedPoint.frequency / point.frequency)) < 1 / 96,
      );
      return index >= 0 ? prepared.reliability[index] : 1;
    }),
  );

  const medianGrid = prepared.detailed;
  const medianResponse = computeFilterResponseArray(filters, medianGrid, options.sampleRate);

  const medianCost = measurementCost(
    medianGrid,
    prepared.target,
    medianResponse,
    prepared.reliability,
    options,
  );

  const perMeasurementCosts = measurements.map((measurement) => {
    const aligned = resampleToGrid(measurement, grid);
    return measurementCost(
      aligned,
      simTarget,
      filterResponse,
      simReliability,
      options,
    );
  });

  const worstCost = Math.max(...perMeasurementCosts, medianCost);

  const boost = boostPenalty(filters);
  const overlap = overlapPenalty(filters);
  const cancellation = cancellationPenalty(filters);
  const q = qPenalty(filters);
  const headroom = headroomPenalty(filters, grid, options.sampleRate);
  const filterCount = filterCountPenalty(filters, options.maxFilters);

  const total =
    MEDIAN_WORST_SPLIT.median * medianCost +
    MEDIAN_WORST_SPLIT.worst * worstCost +
    boost +
    q +
    overlap +
    cancellation +
    headroom +
    filterCount;

  return {
    total,
    medianMeasurementCost: medianCost,
    worstMeasurementCost: worstCost,
    boostPenalty: boost,
    overlapPenalty: overlap,
    cancellationPenalty: cancellation,
    qPenalty: q,
    headroomPenalty: headroom,
    filterCountPenalty: filterCount,
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
    db: point.db + getCombinedFilterResponseDb(filters, point.frequency, options.sampleRate),
  }));
}

import { COST_ERROR_CLAMP_DB } from './constants';
import { getCombinedFilterResponseDb } from './biquad';
import { clamp, frequencyWeight, huber } from './math';
import type {
  AutoEqOptions,
  FrequencyPoint,
  GeneratedEqFilter,
  PreparedMeasurementGrid,
} from './types';

export interface CostBreakdown {
  total: number;
  medianMeasurementCost: number;
  worstMeasurementCost: number;
}

function measurementCost(
  measured: FrequencyPoint[],
  target: FrequencyPoint[],
  filterResponse: number[],
  reliability: Float64Array,
  options: AutoEqOptions,
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

    totalLoss += huber(limitedError) * weight;
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
      penalty += 0.66 * filter.gainDb * filter.gainDb;
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
      if (distance < 1 / 24) {
        penalty += 0.08;
      }
    }
  }
  return penalty;
}

function headroomPenalty(filters: GeneratedEqFilter[], grid: FrequencyPoint[], sampleRate: number): number {
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
  prepared: PreparedMeasurementGrid,
  measurements: FrequencyPoint[][],
  filters: GeneratedEqFilter[],
  options: AutoEqOptions,
): CostBreakdown {
  const grid = prepared.detailed;
  const filterResponse = computeFilterResponseArray(filters, grid, options.sampleRate);

  const medianCost = measurementCost(
    grid,
    prepared.target,
    filterResponse,
    prepared.reliability,
    options,
  );

  const perMeasurementCosts = measurements.map((measurement) => {
    const aligned = grid.map((point, index) => ({
      frequency: point.frequency,
      db: measurement[index]?.db ?? grid[index].db,
    }));
    return measurementCost(
      aligned,
      prepared.target,
      filterResponse,
      prepared.reliability,
      options,
    );
  });

  const worstCost = Math.max(...perMeasurementCosts, medianCost);

  const total =
    0.7 * medianCost +
    0.3 * worstCost +
    boostPenalty(filters) +
    qPenalty(filters) +
    overlapPenalty(filters) +
    headroomPenalty(filters, grid, options.sampleRate) +
    filterCountPenalty(filters, options.maxFilters);

  return {
    total,
    medianMeasurementCost: medianCost,
    worstMeasurementCost: worstCost,
  };
}

export function computePredictedCurve(
  prepared: PreparedMeasurementGrid,
  filters: GeneratedEqFilter[],
  options: AutoEqOptions,
): FrequencyPoint[] {
  return prepared.detailed.map((point) => ({
    frequency: point.frequency,
    db:
      point.db +
      getCombinedFilterResponseDb(filters, point.frequency, options.sampleRate),
  }));
}

export function computeErrorMetrics(
  prepared: PreparedMeasurementGrid,
  filters: GeneratedEqFilter[],
  options: AutoEqOptions,
): {
  rmsErrorDb: number;
  maximumErrorDb: number;
  scalarError: number;
} {
  const predicted = computePredictedCurve(prepared, filters, options);
  const errors = predicted.map(
    (point, index) => point.db - prepared.target[index].db,
  );

  const clamped = errors.map((error) => clamp(error, -COST_ERROR_CLAMP_DB, COST_ERROR_CLAMP_DB));
  const weights = prepared.detailed.map((point) => frequencyWeight(point.frequency));

  let weightedSum = 0;
  let weightTotal = 0;
  for (let index = 0; index < clamped.length; index += 1) {
    weightedSum += huber(clamped[index]) * weights[index];
    weightTotal += weights[index];
  }

  const scalarError = weightedSum / Math.max(weightTotal, 1);
  const rmsErrorDb = Math.sqrt(
    clamped.reduce((sum, value) => sum + value * value, 0) / Math.max(clamped.length, 1),
  );
  const maximumErrorDb = Math.max(...clamped.map((value) => Math.abs(value)));

  return { rmsErrorDb, maximumErrorDb, scalarError };
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

export function computeBeforeMetrics(
  prepared: PreparedMeasurementGrid,
  options: AutoEqOptions,
): {
  rmsErrorDb: number;
  maximumErrorDb: number;
  scalarError: number;
} {
  return computeErrorMetrics(prepared, [], options);
}

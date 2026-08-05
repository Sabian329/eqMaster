import { MIN_FILTER_GAIN_DB } from './constants';
import { calculateTotalCost } from './costFunction';
import { clampFilterGain, clampFilterQ } from './frequencyLimits';
import { cloneFilter, createFilterId } from './candidateGeneration';
import { getCombinedFilterResponseDb } from './biquad';
import { getPrecisionSettings } from './precision';
import type {
  AutoEqOptions,
  FrequencyPoint,
  GeneratedEqFilter,
  PreparedMeasurementGrid,
} from './types';

function responseCorrelation(
  left: GeneratedEqFilter,
  right: GeneratedEqFilter,
  grid: FrequencyPoint[],
  sampleRate: number,
): number {
  const leftResponse = grid.map((point) => getCombinedFilterResponseDb([left], point.frequency, sampleRate));
  const rightResponse = grid.map((point) => getCombinedFilterResponseDb([right], point.frequency, sampleRate));

  const leftMean = leftResponse.reduce((sum, value) => sum + value, 0) / leftResponse.length;
  const rightMean = rightResponse.reduce((sum, value) => sum + value, 0) / rightResponse.length;

  let numerator = 0;
  let leftDenominator = 0;
  let rightDenominator = 0;

  for (let index = 0; index < leftResponse.length; index += 1) {
    const leftDelta = leftResponse[index] - leftMean;
    const rightDelta = rightResponse[index] - rightMean;
    numerator += leftDelta * rightDelta;
    leftDenominator += leftDelta * leftDelta;
    rightDenominator += rightDelta * rightDelta;
  }

  const denominator = Math.sqrt(leftDenominator * rightDenominator);
  return denominator > 0 ? numerator / denominator : 0;
}

function tryMergeFilters(
  left: GeneratedEqFilter,
  right: GeneratedEqFilter,
): GeneratedEqFilter {
  const mergedFrequency = Math.sqrt(left.frequency * right.frequency);
  const mergedGain = (left.gainDb + right.gainDb) * 0.55;
  const mergedQ = Math.max(left.q, right.q) * 0.9;

  return {
    id: createFilterId(),
    type: left.type === right.type ? left.type : 'PK',
    frequency: mergedFrequency,
    gainDb: mergedGain,
    q: mergedQ,
    enabled: true,
    confidence: Math.max(left.confidence, right.confidence),
    improvementPercent: Math.max(left.improvementPercent, right.improvementPercent),
    affectedRange: {
      fromHz: Math.min(left.affectedRange.fromHz, right.affectedRange.fromHz),
      toHz: Math.max(left.affectedRange.toHz, right.affectedRange.toHz),
    },
    reason: left.reason,
  };
}

export function postProcessFilters(
  filters: GeneratedEqFilter[],
  prepared: PreparedMeasurementGrid,
  measurements: FrequencyPoint[][],
  options: AutoEqOptions,
): GeneratedEqFilter[] {
  const precision = getPrecisionSettings(options.precision);
  let current = filters
    .map(cloneFilter)
    .filter((filter) => Math.abs(filter.gainDb) >= MIN_FILTER_GAIN_DB);

  const baseCost = calculateTotalCost(prepared, measurements, current, options).total;

  for (let index = current.length - 1; index >= 0; index -= 1) {
    const without = current.filter((_, filterIndex) => filterIndex !== index);
    const withoutCost = calculateTotalCost(prepared, measurements, without, options).total;
    const relativeWorsening = ((withoutCost - baseCost) / Math.max(baseCost, 1e-6)) * 100;

    if (relativeWorsening < precision.minImprovementPercent) {
      current = without;
    }
  }

  for (let left = 0; left < current.length; left += 1) {
    for (let right = left + 1; right < current.length; right += 1) {
      const distance = Math.abs(
        Math.log2(current[left].frequency / current[right].frequency),
      );
      if (distance >= 1 / 12) continue;
      if (Math.sign(current[left].gainDb) !== Math.sign(current[right].gainDb)) continue;

      const correlation = responseCorrelation(
        current[left],
        current[right],
        prepared.detailed,
        options.sampleRate,
      );
      if (correlation < 0.85) continue;

      const merged = tryMergeFilters(current[left], current[right]);
      merged.gainDb = clampFilterGain(merged.gainDb, merged.frequency, merged.type);
      merged.q = clampFilterQ(merged.q, merged.frequency, merged.gainDb, merged.type);

      const withMerged = current.filter(
        (_, index) => index !== left && index !== right,
      );
      withMerged.push(merged);

      const mergedCost = calculateTotalCost(prepared, measurements, withMerged, options).total;
      const currentCost = calculateTotalCost(prepared, measurements, current, options).total;

      if (mergedCost <= currentCost * 1.02) {
        current = withMerged.sort((a, b) => a.frequency - b.frequency);
        break;
      }
    }
  }

  return current.slice(0, options.maxFilters);
}

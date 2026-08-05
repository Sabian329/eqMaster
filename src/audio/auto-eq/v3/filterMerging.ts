import { MERGE_CORRELATION_THRESHOLD, MERGE_DISTANCE_OCTAVES } from './constants';
import { calculateTotalCost } from './costFunction';
import { clampFilterGain, clampFilterQ } from './frequencyLimits';
import { cloneFilter, createFilterId } from './candidatePool';
import { distanceOctaves, responseCorrelation } from './filterSimilarity';
import type {
  AutoEqV3Options,
  FrequencyPoint,
  GeneratedEqFilter,
  PreparedMeasurement,
} from './types';

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
    contributionPercent: Math.max(left.contributionPercent, right.contributionPercent),
    affectedRange: {
      fromHz: Math.min(left.affectedRange.fromHz, right.affectedRange.fromHz),
      toHz: Math.max(left.affectedRange.toHz, right.affectedRange.toHz),
    },
    reason: left.reason,
  };
}

export function mergeSimilarFilters(
  filters: GeneratedEqFilter[],
  prepared: PreparedMeasurement,
  measurements: FrequencyPoint[][],
  options: AutoEqV3Options,
): GeneratedEqFilter[] {
  let current = filters.map(cloneFilter).sort((a, b) => a.frequency - b.frequency);
  let merged = true;

  while (merged) {
    merged = false;
    for (let left = 0; left < current.length; left += 1) {
      for (let right = left + 1; right < current.length; right += 1) {
        const distance = distanceOctaves(current[left].frequency, current[right].frequency);
        if (distance >= MERGE_DISTANCE_OCTAVES) continue;
        if (Math.sign(current[left].gainDb) !== Math.sign(current[right].gainDb)) continue;

        const correlation = responseCorrelation(
          current[left],
          current[right],
          prepared.detailed,
          options.sampleRate,
        );
        if (correlation < MERGE_CORRELATION_THRESHOLD) continue;

        const mergedFilter = tryMergeFilters(current[left], current[right]);
        mergedFilter.gainDb = clampFilterGain(
          mergedFilter.gainDb,
          mergedFilter.frequency,
          mergedFilter.type,
        );
        mergedFilter.q = clampFilterQ(
          mergedFilter.q,
          mergedFilter.frequency,
          mergedFilter.gainDb,
          mergedFilter.type,
        );

        const withMerged = current.filter(
          (_, index) => index !== left && index !== right,
        );
        withMerged.push(mergedFilter);

        const mergedCost = calculateTotalCost(
          prepared,
          measurements,
          withMerged,
          options,
        ).total;
        const currentCost = calculateTotalCost(
          prepared,
          measurements,
          current,
          options,
        ).total;

        if (mergedCost <= currentCost * 1.02) {
          current = withMerged.sort((a, b) => a.frequency - b.frequency);
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
  }

  return current.slice(0, options.maxFilters);
}

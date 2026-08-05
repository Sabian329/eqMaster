import {
  MIN_FILTER_GAIN_DB,
} from './constants';
import {
  candidateToFilter,
  cloneFilter,
  generateResonanceCandidates,
  generateTonalCandidates,
  resetCandidateCounter,
} from './candidateGeneration';
import { calculateTotalCost } from './costFunction';
import { clampFilterGain, clampFilterQ } from './frequencyLimits';
import { getPrecisionSettings } from './precision';
import { detectBroadTonalErrors, detectResonances } from './resonanceDetection';
import type {
  AutoEqOptions,
  AutoEqProgress,
  FilterCandidate,
  FrequencyPoint,
  GeneratedEqFilter,
  PreparedMeasurementGrid,
} from './types';

export type ProgressCallback = (progress: AutoEqProgress) => void;

function tryAddBestCandidate(
  filters: GeneratedEqFilter[],
  candidates: FilterCandidate[],
  prepared: PreparedMeasurementGrid,
  measurements: FrequencyPoint[][],
  options: AutoEqOptions,
  cutsOnly = false,
): { filters: GeneratedEqFilter[]; improved: boolean; improvementPercent: number } {
  const baseCost = calculateTotalCost(prepared, measurements, filters, options).total;
  let bestFilters = filters;
  let bestCost = baseCost;
  let bestImprovement = 0;

  const pool = cutsOnly ? candidates.filter((candidate) => candidate.gainDb < 0) : candidates;

  for (const candidate of pool) {
    const nextFilters = [...filters, candidateToFilter(candidate)];
    const nextCost = calculateTotalCost(prepared, measurements, nextFilters, options).total;
    const improvement = ((baseCost - nextCost) / Math.max(baseCost, 1e-6)) * 100;
    const isCut = candidate.gainDb < 0;

    if (nextCost < bestCost && Math.abs(candidate.gainDb) >= MIN_FILTER_GAIN_DB) {
      const shouldReplace =
        !isCut ||
        bestFilters.length === filters.length ||
        nextCost < bestCost - 1e-6 ||
        candidate.gainDb < 0;

      if (shouldReplace) {
        bestCost = nextCost;
        bestFilters = nextFilters;
        bestImprovement = improvement;
      }
    }
  }

  return {
    filters: bestFilters,
    improved: bestFilters.length > filters.length,
    improvementPercent: bestImprovement,
  };
}

function optimizeFilterGains(
  filters: GeneratedEqFilter[],
  prepared: PreparedMeasurementGrid,
  measurements: FrequencyPoint[][],
  options: AutoEqOptions,
): GeneratedEqFilter[] {
  const precision = getPrecisionSettings(options.precision);
  let current = filters.map(cloneFilter);
  let bestCost = calculateTotalCost(prepared, measurements, current, options).total;

  for (let pass = 0; pass < precision.gainOptimizePasses; pass += 1) {
    let improved = false;
    for (let index = 0; index < current.length; index += 1) {
      for (const delta of precision.gainOptimizeDeltasDb) {
        const trial = current.map(cloneFilter);
        trial[index].gainDb = clampFilterGain(
          trial[index].gainDb + delta,
          trial[index].frequency,
          trial[index].type,
        );
        const trialCost = calculateTotalCost(prepared, measurements, trial, options).total;
        if (trialCost < bestCost) {
          bestCost = trialCost;
          current = trial;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }

  return current;
}

export function greedyFilterSelection(
  prepared: PreparedMeasurementGrid,
  measurements: FrequencyPoint[][],
  options: AutoEqOptions,
  onProgress?: ProgressCallback,
): GeneratedEqFilter[] {
  resetCandidateCounter();
  const precision = getPrecisionSettings(options.precision);
  const resonances = detectResonances(prepared);
  const tonalSegments = detectBroadTonalErrors(prepared);
  const resonanceCandidates = generateResonanceCandidates(resonances, prepared, options);
  const tonalCandidates = generateTonalCandidates(tonalSegments, prepared, options);
  const cutCandidates = [...resonanceCandidates, ...tonalCandidates.filter((item) => item.gainDb < 0)];
  const allCandidates = [...cutCandidates, ...tonalCandidates.filter((item) => item.gainDb >= 0)];

  onProgress?.({
    stage: 'generating-candidates',
    progress: 0.2,
    filterCount: 0,
  });

  let filters: GeneratedEqFilter[] = [];
  let baseCost = calculateTotalCost(prepared, measurements, filters, options).total;
  let cutsOnlyPhase = true;

  for (let iteration = 0; iteration < options.maxFilters; iteration += 1) {
    onProgress?.({
      stage: 'selecting-filters',
      progress: 0.2 + (iteration / options.maxFilters) * 0.35,
      filterCount: filters.length,
      currentCost: baseCost,
    });

    const candidatePool = cutsOnlyPhase ? cutCandidates : allCandidates;
    const result = tryAddBestCandidate(
      filters,
      candidatePool,
      prepared,
      measurements,
      options,
      cutsOnlyPhase,
    );

    if (!result.improved) {
      if (cutsOnlyPhase) {
        cutsOnlyPhase = false;
        iteration -= 1;
        continue;
      }
      break;
    }

    if (result.improvementPercent < precision.minIterationImprovementPercent) {
      if (cutsOnlyPhase) {
        cutsOnlyPhase = false;
        iteration -= 1;
        continue;
      }
      break;
    }

    filters = optimizeFilterGains(result.filters, prepared, measurements, options);
    const nextCost = calculateTotalCost(prepared, measurements, filters, options).total;

    const latest = filters[filters.length - 1];
    if (!latest || Math.abs(latest.gainDb) < MIN_FILTER_GAIN_DB) {
      filters.pop();
      break;
    }

    latest.improvementPercent = result.improvementPercent;
    const improvement = ((baseCost - nextCost) / Math.max(baseCost, 1e-6)) * 100;
    if (improvement < precision.minIterationImprovementPercent) break;

    baseCost = nextCost;
  }

  return filters;
}

function coordinateDescentPass(
  filters: GeneratedEqFilter[],
  prepared: PreparedMeasurementGrid,
  measurements: FrequencyPoint[][],
  options: AutoEqOptions,
  frequencyStep: number,
  gainStep: number,
  qMultiplier: number,
): GeneratedEqFilter[] {
  let current = filters.map(cloneFilter);
  let bestCost = calculateTotalCost(prepared, measurements, current, options).total;

  for (let index = 0; index < current.length; index += 1) {
    const original = cloneFilter(current[index]);
    const trials: GeneratedEqFilter[][] = [];

    const frequencyVariants = [
      original.frequency * 2 ** frequencyStep,
      original.frequency / 2 ** frequencyStep,
    ];
    const gainVariants = [original.gainDb + gainStep, original.gainDb - gainStep];
    const qVariants = [original.q * qMultiplier, original.q / qMultiplier];

    for (const frequency of frequencyVariants) {
      const trial = current.map(cloneFilter);
      trial[index].frequency = frequency;
      trial[index].gainDb = clampFilterGain(trial[index].gainDb, frequency, trial[index].type);
      trial[index].q = clampFilterQ(
        trial[index].q,
        frequency,
        trial[index].gainDb,
        trial[index].type,
      );
      trials.push(trial);
    }

    for (const gainDb of gainVariants) {
      const trial = current.map(cloneFilter);
      trial[index].gainDb = clampFilterGain(gainDb, trial[index].frequency, trial[index].type);
      trials.push(trial);
    }

    for (const q of qVariants) {
      const trial = current.map(cloneFilter);
      trial[index].q = clampFilterQ(
        q,
        trial[index].frequency,
        trial[index].gainDb,
        trial[index].type,
      );
      trials.push(trial);
    }

    const withoutFilter = current.filter((_, filterIndex) => filterIndex !== index);
    trials.push(withoutFilter);

    for (const trial of trials) {
      const trialCost = calculateTotalCost(prepared, measurements, trial, options).total;
      if (trialCost < bestCost) {
        bestCost = trialCost;
        current = trial;
      }
    }
  }

  return current;
}

export function globalOptimization(
  initialFilters: GeneratedEqFilter[],
  prepared: PreparedMeasurementGrid,
  measurements: FrequencyPoint[][],
  options: AutoEqOptions,
  onProgress?: ProgressCallback,
): GeneratedEqFilter[] {
  const precision = getPrecisionSettings(options.precision);
  const starts: GeneratedEqFilter[][] = [
    initialFilters.map(cloneFilter),
    initialFilters.map((filter) => {
      const clone = cloneFilter(filter);
      clone.frequency *= 2 ** (1 / 48);
      clone.gainDb = clampFilterGain(clone.gainDb, clone.frequency, clone.type);
      return clone;
    }),
    initialFilters.map((filter) => {
      const clone = cloneFilter(filter);
      clone.q = clampFilterQ(clone.q * 1.15, clone.frequency, clone.gainDb, clone.type);
      return clone;
    }),
  ];

  if (precision.optimizerStarts >= 4) {
    starts.push(
      initialFilters.map((filter) => {
        const clone = cloneFilter(filter);
        clone.frequency /= 2 ** (1 / 48);
        clone.gainDb = clampFilterGain(clone.gainDb, clone.frequency, clone.type);
        return clone;
      }),
    );
  }

  if (precision.optimizerStarts >= 5) {
    starts.push(
      initialFilters.map((filter) => {
        const clone = cloneFilter(filter);
        clone.q = clampFilterQ(clone.q * 0.88, clone.frequency, clone.gainDb, clone.type);
        return clone;
      }),
    );
  }

  let bestFilters = initialFilters;
  let bestCost = calculateTotalCost(prepared, measurements, bestFilters, options).total;

  for (let startIndex = 0; startIndex < starts.length; startIndex += 1) {
    let current = starts[startIndex].filter((filter) => Math.abs(filter.gainDb) >= MIN_FILTER_GAIN_DB);

    for (let pass = 0; pass < precision.optimizerPasses; pass += 1) {
      onProgress?.({
        stage: 'optimizing',
        progress: 0.55 + (startIndex / starts.length) * 0.25 + pass / (starts.length * precision.optimizerPasses),
        filterCount: current.length,
        currentCost: bestCost,
      });

      const beforeCost = calculateTotalCost(prepared, measurements, current, options).total;
      let improved = false;

      for (let stage = 0; stage < precision.frequencyStepsOctaves.length; stage += 1) {
        const next = coordinateDescentPass(
          current,
          prepared,
          measurements,
          options,
          precision.frequencyStepsOctaves[stage],
          precision.gainStepsDb[stage] ?? precision.gainStepsDb.at(-1) ?? 0.1,
          precision.qMultipliersPerStage[stage] ?? precision.qMultipliersPerStage.at(-1) ?? 1.02,
        );
        const nextCost = calculateTotalCost(prepared, measurements, next, options).total;
        if (nextCost < beforeCost - 1e-6) {
          current = next;
          improved = true;
        }
      }

      const currentCost = calculateTotalCost(prepared, measurements, current, options).total;
      if (currentCost < bestCost) {
        bestCost = currentCost;
        bestFilters = current.map(cloneFilter);
      }

      if (!improved) break;
    }
  }

  return bestFilters;
}

import {
  MAX_OPTIMIZER_PASSES,
  MIN_FILTER_GAIN_DB,
  MULTI_START_VARIANTS,
  OPTIMIZATION_STAGES,
} from './constants';
import { cloneFilter } from './candidatePool';
import { calculateTotalCost } from './costFunction';
import { clampFilterGain, clampFilterQ } from './frequencyLimits';
import { SeededRandom } from './math';
import type {
  AutoEqV3Options,
  AutoEqV3Progress,
  FrequencyPoint,
  GeneratedEqFilter,
  PreparedMeasurement,
} from './types';

export type ProgressCallback = (progress: AutoEqV3Progress) => void;

function coordinateDescentPass(
  filters: GeneratedEqFilter[],
  prepared: PreparedMeasurement,
  measurements: FrequencyPoint[][],
  options: AutoEqV3Options,
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

function buildMultiStartVariants(
  initialFilters: GeneratedEqFilter[],
  seed: number,
): GeneratedEqFilter[][] {
  const random = new SeededRandom(seed);
  const starts: GeneratedEqFilter[][] = [initialFilters.map(cloneFilter)];

  if (MULTI_START_VARIANTS >= 2) {
    starts.push(
      initialFilters.map((filter) => {
        const clone = cloneFilter(filter);
        clone.frequency *= 2 ** (1 / 48);
        clone.gainDb = clampFilterGain(clone.gainDb, clone.frequency, clone.type);
        return clone;
      }),
    );
  }

  if (MULTI_START_VARIANTS >= 3) {
    starts.push(
      initialFilters.map((filter) => {
        const clone = cloneFilter(filter);
        clone.q = clampFilterQ(clone.q * 1.15, clone.frequency, clone.gainDb, clone.type);
        return clone;
      }),
    );
  }

  if (starts.length < MULTI_START_VARIANTS) {
    starts.push(
      initialFilters.map((filter) => {
        const clone = cloneFilter(filter);
        const jitter = (random.next() - 0.5) / 24;
        clone.frequency *= 2 ** jitter;
        clone.gainDb = clampFilterGain(clone.gainDb, clone.frequency, clone.type);
        return clone;
      }),
    );
  }

  return starts.slice(0, MULTI_START_VARIANTS);
}

export function globalOptimization(
  initialFilters: GeneratedEqFilter[],
  prepared: PreparedMeasurement,
  measurements: FrequencyPoint[][],
  options: AutoEqV3Options,
  onProgress?: ProgressCallback,
): GeneratedEqFilter[] {
  const starts = buildMultiStartVariants(initialFilters, options.seed);

  let bestFilters = initialFilters.map(cloneFilter);
  let bestCost = calculateTotalCost(prepared, measurements, bestFilters, options).total;

  for (let startIndex = 0; startIndex < starts.length; startIndex += 1) {
    let current = starts[startIndex].filter(
      (filter) => Math.abs(filter.gainDb) >= MIN_FILTER_GAIN_DB,
    );

    for (let pass = 0; pass < MAX_OPTIMIZER_PASSES; pass += 1) {
      onProgress?.({
        stage: 'optimizing',
        progress:
          0.55 +
          (startIndex / starts.length) * 0.25 +
          pass / (starts.length * MAX_OPTIMIZER_PASSES),
        filterCount: current.length,
        currentCost: bestCost,
        iteration: pass,
      });

      const beforeCost = calculateTotalCost(prepared, measurements, current, options).total;
      let improved = false;

      for (let stage = 0; stage < OPTIMIZATION_STAGES.frequencyStepsOctaves.length; stage += 1) {
        const next = coordinateDescentPass(
          current,
          prepared,
          measurements,
          options,
          OPTIMIZATION_STAGES.frequencyStepsOctaves[stage],
          OPTIMIZATION_STAGES.gainStepsDb[stage] ?? OPTIMIZATION_STAGES.gainStepsDb.at(-1) ?? 0.1,
          OPTIMIZATION_STAGES.qMultipliersPerStage[stage] ??
            OPTIMIZATION_STAGES.qMultipliersPerStage.at(-1) ??
            1.02,
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

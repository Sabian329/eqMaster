import type { AutoEqOptions } from './types';

export type AutoEqPrecision = 'standard' | 'high';

export interface AutoEqPrecisionSettings {
  measurementGridSize: number;
  preampGridSize: number;
  optimizerPasses: number;
  optimizerStarts: number;
  gainOptimizePasses: number;
  minIterationImprovementPercent: number;
  minImprovementPercent: number;
  frequencyStepsOctaves: readonly number[];
  gainStepsDb: readonly number[];
  qMultipliersPerStage: readonly number[];
  gainOptimizeDeltasDb: readonly number[];
}

const STANDARD_PRECISION: AutoEqPrecisionSettings = {
  measurementGridSize: 512,
  preampGridSize: 4096,
  optimizerPasses: 12,
  optimizerStarts: 3,
  gainOptimizePasses: 3,
  minIterationImprovementPercent: 0.3,
  minImprovementPercent: 0.15,
  frequencyStepsOctaves: [1 / 12, 1 / 24, 1 / 48, 1 / 96],
  gainStepsDb: [1, 0.5, 0.25, 0.1],
  qMultipliersPerStage: [1.5, 1.25, 1.1, 1.04],
  gainOptimizeDeltasDb: [0.5, 0.25, -0.25, -0.5],
};

const HIGH_PRECISION: AutoEqPrecisionSettings = {
  measurementGridSize: 1024,
  preampGridSize: 8192,
  optimizerPasses: 24,
  optimizerStarts: 5,
  gainOptimizePasses: 8,
  minIterationImprovementPercent: 0.12,
  minImprovementPercent: 0.08,
  frequencyStepsOctaves: [1 / 12, 1 / 24, 1 / 48, 1 / 96, 1 / 192],
  gainStepsDb: [1, 0.5, 0.25, 0.1, 0.05],
  qMultipliersPerStage: [1.5, 1.25, 1.12, 1.06, 1.02],
  gainOptimizeDeltasDb: [0.5, 0.25, 0.1, -0.1, -0.25, -0.5],
};

export function getPrecisionSettings(
  precision: AutoEqPrecision = 'standard',
): AutoEqPrecisionSettings {
  return precision === 'high' ? HIGH_PRECISION : STANDARD_PRECISION;
}

export function resolveAutoEqOptions(
  partial: Partial<AutoEqOptions> = {},
): AutoEqOptions {
  return {
    targetType: partial.targetType ?? 'room',
    maxFilters: partial.maxFilters ?? 16,
    allowBoosts: partial.allowBoosts ?? true,
    fullRangeCorrection: partial.fullRangeCorrection ?? true,
    minFrequency: partial.minFrequency ?? 20,
    maxFrequency: partial.maxFrequency ?? 20_000,
    sampleRate: partial.sampleRate ?? 48_000,
    seed: partial.seed ?? 42,
    precision: partial.precision ?? 'standard',
  };
}

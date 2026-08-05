import type { CurvePoint, Suggestion } from '../types';
import {
  generateAutoEq,
  interpolateLogarithmically,
  type AutoEqResult,
} from '../audio/autoEq';

export const PRO_MAX_AUTO_BANDS = 16;

export interface AutoEqPipelineOptions {
  sampleRate?: number;
  fStart?: number;
  fEnd?: number;
  maxFilters?: number;
  maxCorrectionFrequency?: number;
}

export function autoEqFiltersToSuggestions(result: AutoEqResult): Suggestion[] {
  return result.filters.map((filter) => {
    const measuredDb = interpolateLogarithmically(
      result.measured,
      filter.frequency,
    );
    const targetDb = interpolateLogarithmically(result.target, filter.frequency);
    const deviation = measuredDb - targetDb;

    return {
      kind: filter.gainDb < 0 ? 'cut' : 'boost',
      frequency: filter.frequency,
      deviation,
      gain: filter.gainDb,
      q: filter.q,
      note: 'Pro (thick) Auto EQ — RBJ peaking, iterative fit.',
      source: 'auto',
      enabled: true,
    };
  });
}

export function runAutoEqPipeline(
  rawCurve: CurvePoint[],
  options: AutoEqPipelineOptions = {},
): AutoEqResult & { suggestions: Suggestion[] } {
  const result = generateAutoEq(rawCurve, {
    sampleRate: options.sampleRate ?? 48_000,
    minFrequency: Math.max(20, options.fStart ?? 20),
    maxAnalysisFrequency: options.fEnd ?? 20_000,
    maxCorrectionFrequency: options.maxCorrectionFrequency ?? 1_000,
    maxFilters: options.maxFilters ?? PRO_MAX_AUTO_BANDS,
    smoothingFraction: 12,
    target: 'flat',
  });

  return {
    ...result,
    suggestions: autoEqFiltersToSuggestions(result),
  };
}

import type { CurvePoint, Suggestion } from '../types';
import type { AutoEqResult, PeakingEqFilter } from '../audio/autoEq';
import { generateAutoEqV2 } from '../audio/auto-eq/autoEq';
import { interpolateLogarithmically } from '../audio/auto-eq/math';
import type { AutoEqResultV2, GeneratedEqFilter } from '../audio/auto-eq/types';
import type { AutoEqPipelineOptions } from './autoEqBridge';
import { PRO_MAX_AUTO_BANDS } from './autoEqBridge';

const REASON_LABELS: Record<GeneratedEqFilter['reason'], string> = {
  'modal-resonance': 'Modal resonance',
  'repeated-peak': 'Repeated peak',
  'broad-tonal-error': 'Broad tonal error',
  'low-frequency-tilt': 'Low-frequency tilt',
  'high-frequency-tilt': 'High-frequency tilt',
};

function v2FilterToSuggestion(
  filter: GeneratedEqFilter,
  measured: CurvePoint[],
  target: CurvePoint[],
): Suggestion {
  const measuredDb = interpolateLogarithmically(measured, filter.frequency);
  const targetDb = interpolateLogarithmically(target, filter.frequency);
  const deviation = measuredDb - targetDb;

  return {
    kind: filter.gainDb < 0 ? 'cut' : 'boost',
    frequency: filter.frequency,
    deviation,
    gain: filter.gainDb,
    q: filter.q,
    note: `V2 Auto EQ — ${REASON_LABELS[filter.reason]} (conf ${Math.round(filter.confidence * 100)}%).`,
    source: 'auto',
    enabled: filter.enabled,
    filterType: filter.type,
  };
}

function v2PeakingFilters(filters: GeneratedEqFilter[]): PeakingEqFilter[] {
  return filters
    .filter((filter) => filter.type === 'PK')
    .map((filter) => ({
      type: 'PK' as const,
      frequency: filter.frequency,
      gainDb: filter.gainDb,
      q: filter.q,
    }));
}

function mapV2ToLegacyResult(result: AutoEqResultV2): AutoEqResult {
  return {
    filters: v2PeakingFilters(result.filters),
    preampDb: result.preampDb,
    measured: result.measured,
    target: result.target,
    corrected: result.predicted,
    errorBefore: result.errorBefore,
    errorAfter: result.errorAfter,
  };
}

export interface AutoEqPipelineV2Options extends AutoEqPipelineOptions {
  measurements?: CurvePoint[][];
  targetType?: 'flat' | 'room' | 'custom';
  allowBoosts?: boolean;
  fullRangeCorrection?: boolean;
}

export function runAutoEqPipelineV2(
  rawCurve: CurvePoint[],
  options: AutoEqPipelineV2Options = {},
): AutoEqResult & { suggestions: Suggestion[]; v2?: AutoEqResultV2 } {
  const measurements =
    options.measurements && options.measurements.length > 0
      ? options.measurements
      : [rawCurve];

  const result = generateAutoEqV2(measurements, {
    sampleRate: options.sampleRate ?? 48_000,
    minFrequency: Math.max(20, options.fStart ?? 20),
    maxFrequency: options.fEnd ?? 20_000,
    maxFilters: options.maxFilters ?? PRO_MAX_AUTO_BANDS,
    targetType: options.targetType ?? 'room',
    allowBoosts: options.allowBoosts ?? true,
    fullRangeCorrection: options.fullRangeCorrection ?? true,
  });

  const suggestions = result.filters.map((filter) =>
    v2FilterToSuggestion(filter, result.measured, result.target),
  );

  return {
    ...mapV2ToLegacyResult(result),
    suggestions,
    v2: result,
  };
}

export function mapAutoEqV2ResultToPipeline(
  result: AutoEqResultV2,
): AutoEqResult & { suggestions: Suggestion[]; v2: AutoEqResultV2 } {
  const suggestions = result.filters.map((filter) =>
    v2FilterToSuggestion(filter, result.measured, result.target),
  );

  return {
    ...mapV2ToLegacyResult(result),
    suggestions,
    v2: result,
  };
}

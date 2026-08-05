import type { CurvePoint, Suggestion } from '../types';
import { getFilterResponseDb } from '../audio/auto-eq/biquad';
import { qToBandwidthOctaves } from './format';

const PREVIEW_SAMPLE_RATE = 48_000;

/** Peaking-filter magnitude (dB) for EQ preview — matches PK / BW Oct preset shape. */
export function peakingFilterMagnitudeDb(
  frequency: number,
  centerFrequency: number,
  gainDb: number,
  q: number,
): number {
  if (frequency <= 0 || centerFrequency <= 0 || gainDb === 0) return 0;

  const bandwidthOctaves = Math.max(0.05, qToBandwidthOctaves(q));
  const logOffset = Math.log2(frequency / centerFrequency);
  const halfWidth = bandwidthOctaves / 2;
  const shape = 1 / (1 + (logOffset / halfWidth) ** 2);

  return gainDb * shape;
}

function filterMagnitudeDb(frequency: number, filter: Suggestion): number {
  if (filter.gain === null || filter.gain === 0) return 0;

  if (filter.filterType && filter.filterType !== 'PK') {
    return getFilterResponseDb(
      {
        type: filter.filterType,
        frequency: filter.frequency,
        gainDb: filter.gain,
        q: filter.q,
      },
      frequency,
      PREVIEW_SAMPLE_RATE,
    );
  }

  return peakingFilterMagnitudeDb(
    frequency,
    filter.frequency,
    filter.gain,
    filter.q,
  );
}

export function buildCorrectedCurve(
  measuredCurve: CurvePoint[],
  suggestions: Suggestion[],
  preampDb: number,
): CurvePoint[] {
  const safePreamp = Number.isFinite(preampDb)
    ? Math.max(-30, Math.min(12, preampDb))
    : 0;

  const activeFilters = suggestions.filter((item) => {
    if (item.enabled === false) return false;
    if (item.kind === 'null') return false;
    return item.gain !== null && item.gain !== 0;
  });

  return measuredCurve.map((point) => {
    let eqDb = safePreamp;
    for (const filter of activeFilters) {
      eqDb += filterMagnitudeDb(point.frequency, filter);
    }

    return {
      frequency: point.frequency,
      db: Math.max(-54, Math.min(18, point.db + eqDb)),
    };
  });
}

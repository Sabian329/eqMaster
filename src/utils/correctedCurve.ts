import type { CurvePoint, Suggestion } from '../types';
import { qToBandwidthOctaves } from './format';

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
      eqDb += peakingFilterMagnitudeDb(
        point.frequency,
        filter.frequency,
        filter.gain!,
        filter.q,
      );
    }

    return {
      frequency: point.frequency,
      db: Math.max(-54, Math.min(18, point.db + eqDb)),
    };
  });
}

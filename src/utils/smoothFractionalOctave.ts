import type { CurvePoint } from '../types';

/**
 * Fractional-octave Gaussian smoothing for display / EQ input.
 * `fraction` is N in "1/N octave" (e.g. 12 → 1/12). `<= 0` returns a copy (RAW).
 */
export function smoothFractionalOctaveCurve(
  points: CurvePoint[],
  fraction: number,
): CurvePoint[] {
  if (!points.length) return [];
  if (fraction <= 0) return points.map((point) => ({ ...point }));

  const sigmaOctaves = 1 / fraction / 2.355;
  const maximumDistance = sigmaOctaves * 3;

  return points.map((point) => {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const candidate of points) {
      const distance = Math.log2(candidate.frequency / point.frequency);
      if (Math.abs(distance) > maximumDistance) continue;
      const weight = Math.exp(-0.5 * (distance / sigmaOctaves) ** 2);
      weightedSum += candidate.db * weight;
      totalWeight += weight;
    }

    return {
      frequency: point.frequency,
      db: totalWeight > 0 ? weightedSum / totalWeight : point.db,
    };
  });
}

export function applyDisplaySmoothing(
  rawCurve: CurvePoint[],
  fraction: number,
): CurvePoint[] {
  return smoothFractionalOctaveCurve(rawCurve, fraction);
}

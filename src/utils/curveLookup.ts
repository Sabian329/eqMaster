import type { CurvePoint } from '../types';

export function lookupDbAtFrequency(curve: CurvePoint[], frequency: number): number | null {
  if (!curve.length) return null;
  let low = 0;
  let high = curve.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (curve[middle].frequency <= frequency) low = middle;
    else high = middle;
  }
  const point =
    Math.abs(curve[low].frequency - frequency) <
    Math.abs(curve[high].frequency - frequency)
      ? curve[low]
      : curve[high];
  return point.db;
}

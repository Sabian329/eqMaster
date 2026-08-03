import type { CurvePoint } from '../types';

/** Remove unstable HF points and clamp runaway dB values from deconvolution noise. */
export function sanitizeCurve(curve: CurvePoint[]): CurvePoint[] {
  if (curve.length < 3) return curve;

  const clamped = curve.map((point) => ({
    frequency: point.frequency,
    db: Math.max(-54, Math.min(18, point.db)),
  }));

  let end = clamped.length;
  const maxTrailingJumpDb = 8;

  while (end > 3) {
    const previous = clamped[end - 2].db;
    const last = clamped[end - 1].db;
    if (last - previous > maxTrailingJumpDb || last > 12) {
      end--;
    } else {
      break;
    }
  }

  return clamped.slice(0, end);
}

import type { CurvePoint } from '../types';

export const FLAT_TARGET_LABEL = 'Flat (reference)';

export function buildTargetCurve(measuredCurve: CurvePoint[]): CurvePoint[] {
  return measuredCurve.map((point) => ({
    frequency: point.frequency,
    db: 0,
  }));
}

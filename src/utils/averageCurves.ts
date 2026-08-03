import type { CurvePoint } from '../types';

function interpolateDb(curve: CurvePoint[], frequency: number): number | null {
  if (!curve.length) return null;
  if (frequency <= curve[0].frequency) return curve[0].db;
  if (frequency >= curve[curve.length - 1].frequency) return curve[curve.length - 1].db;

  let low = 0;
  let high = curve.length - 1;

  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (curve[middle].frequency <= frequency) low = middle;
    else high = middle;
  }

  const f1 = Math.log(curve[low].frequency);
  const f2 = Math.log(curve[high].frequency);
  const position = (Math.log(frequency) - f1) / (f2 - f1);
  return curve[low].db + position * (curve[high].db - curve[low].db);
}

export function averageCurves(curves: CurvePoint[][]): CurvePoint[] {
  if (!curves.length) return [];
  if (curves.length === 1) return curves[0].map((point) => ({ ...point }));

  const reference = curves.reduce((longest, curve) =>
    curve.length > longest.length ? curve : longest,
  curves[0]);

  return reference.map((point) => {
    let sum = 0;
    let count = 0;

    for (const curve of curves) {
      const db = interpolateDb(curve, point.frequency);
      if (db !== null) {
        sum += db;
        count++;
      }
    }

    return {
      frequency: point.frequency,
      db: count > 0 ? sum / count : point.db,
    };
  });
}

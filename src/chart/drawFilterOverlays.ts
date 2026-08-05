import type { CurvePoint } from '../types';
import { peakingFilterMagnitudeDb } from '../utils/correctedCurve';

export interface FilterOverlay {
  frequency: number;
  gain: number;
  q: number;
  color: string;
}

export function drawFilterOverlays(
  context: CanvasRenderingContext2D,
  frequencyGrid: CurvePoint[],
  overlays: FilterOverlay[],
  xForFrequency: (frequency: number) => number,
  yForDb: (db: number) => number,
): void {
  if (!frequencyGrid.length || !overlays.length) return;

  const zeroY = yForDb(0);

  for (const overlay of overlays) {
    if (!overlay.gain) continue;

    context.save();
    context.beginPath();
    context.moveTo(xForFrequency(frequencyGrid[0].frequency), zeroY);

    for (const point of frequencyGrid) {
      const eqDb = peakingFilterMagnitudeDb(
        point.frequency,
        overlay.frequency,
        overlay.gain,
        overlay.q,
      );
      context.lineTo(xForFrequency(point.frequency), yForDb(eqDb));
    }

    context.lineTo(
      xForFrequency(frequencyGrid[frequencyGrid.length - 1].frequency),
      zeroY,
    );
    context.closePath();

    context.fillStyle = overlay.color;
    context.globalAlpha = 0.34;
    context.fill();

    context.globalAlpha = 0.72;
    context.strokeStyle = overlay.color;
    context.lineWidth = 1.4;
    context.stroke();
    context.restore();
  }
}

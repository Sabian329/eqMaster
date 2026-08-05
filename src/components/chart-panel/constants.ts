import type { RoomEqState } from '../../hooks/useRoomEq';

export function resolveChartFrequencyRange(
  chartSeries: RoomEqState['chartSeries'],
  fMinFallback = 40,
): { fMin: number; fMax: number } {
  const fMin = fMinFallback;
  const fMax = chartSeries.reduce((max, series) => {
    const lastFrequency = series.curve.length
      ? series.curve[series.curve.length - 1].frequency
      : 0;
    return Math.max(max, lastFrequency);
  }, fMin || 40);
  return { fMin, fMax };
}

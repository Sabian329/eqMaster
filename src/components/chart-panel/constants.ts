import type { RoomEqState } from '../../hooks/useRoomEq';
import { formatDb } from '../../utils/format';

export const CHART_STATS = [
  {
    key: 'sampleRate',
    label: 'Sample rate',
    format: (m: NonNullable<RoomEqState['measurementMeta']>) =>
      `${Math.round(m.sampleRate / 1000)} kHz`,
  },
  {
    key: 'peakDb',
    label: 'Input peak',
    format: (m: NonNullable<RoomEqState['measurementMeta']>) => formatDb(m.peakDb),
  },
  {
    key: 'noiseDb',
    label: 'Pre-sweep noise',
    format: (m: NonNullable<RoomEqState['measurementMeta']>) => formatDb(m.noiseDb),
  },
  {
    key: 'samples',
    label: 'Samples',
    format: (m: NonNullable<RoomEqState['measurementMeta']>) =>
      m.samples.toLocaleString('en-US'),
  },
] as const;

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

export function resolveDisplayMeta(state: RoomEqState) {
  return (
    state.averagedRun?.meta ??
    state.measurementRuns[state.measurementRuns.length - 1]?.meta ??
    state.measurementMeta
  );
}

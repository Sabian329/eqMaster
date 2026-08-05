import type { MeasurementCount } from '../../types';

export const SMOOTHING_OPTIONS = [
  { value: 6, label: '1/6 octave' },
  { value: 12, label: '1/12 octave' },
  { value: 24, label: '1/24 octave' },
  { value: 48, label: '1/48 octave' },
] as const;

export const DURATION_OPTIONS = [
  { value: 5, label: '5 s — quick' },
  { value: 10, label: '10 s — recommended' },
  { value: 15, label: '15 s — more accurate' },
] as const;

export const MEASUREMENT_COUNT_OPTIONS: { value: MeasurementCount; label: string }[] = [
  { value: 1, label: '1 measurement' },
  { value: 2, label: '2 measurements (averaged)' },
  { value: 3, label: '3 measurements (averaged)' },
];

export function formatLevelLabel(level: number): string {
  return `${String(level).replace('-', '−')} dB`;
}

export const CHANNEL_OPTIONS = [
  { value: 'both', label: 'L + R' },
  { value: 'left', label: 'L' },
  { value: 'right', label: 'R' },
] as const;

export const SMOOTHING_OPTIONS = [
  { value: 6, label: '1/6 octave' },
  { value: 12, label: '1/12 octave' },
  { value: 24, label: '1/24 octave' },
  { value: 48, label: '1/48 octave' },
] as const;

export function formatLevelLabel(level: number): string {
  return `${String(level).replace('-', '−')} dB`;
}

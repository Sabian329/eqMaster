import type { MeasurementCount } from '../../types';

export const SMOOTHING_OPTIONS = [
  { value: 12, label: '1/12 octave' },
  { value: 6, label: '1/6 octave' },
  { value: 24, label: '1/24 octave' },
  { value: 48, label: '1/48 octave' },
  { value: 0, label: 'RAW (expert)' },
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

/** Number of synthetic complexity profiles for Generate mock. */
export const MOCK_PRESET_COUNT = 9;

/** Short labels for mock complexity buttons (presets 5–9 are stress tests). */
export const MOCK_PRESET_LABELS: Record<number, string> = {
  5: 'Mock 5 · corner',
  6: 'Mock 6 · dense',
  7: 'Mock 7 · 130 Hz',
  8: 'Mock 8 · mid',
  9: 'Mock 9 · full',
};

export function getMockPresetLabel(presetId: number): string {
  return MOCK_PRESET_LABELS[presetId] ?? `Mock ${presetId}`;
}

export function getMockPresetDescription(presetId: number): string | undefined {
  switch (presetId) {
    case 5:
      return 'Corner placement — dense modes, deep SBIR nulls, jagged comb';
    case 6:
      return 'Many narrow peaks 20 Hz–10 kHz';
    case 7:
      return 'Strong 130 Hz cluster + mid + soprano';
    case 8:
      return 'Variant B — shifted mid & treble resonances';
    case 9:
      return 'Max stress — all zones at once';
    default:
      return undefined;
  }
}

export const CHANNEL_OPTIONS = [
  { value: 'both', label: 'L + R (stereo)' },
  { value: 'left', label: 'Left only' },
  { value: 'right', label: 'Right only' },
] as const;

export function formatLevelLabel(level: number): string {
  return `${String(level).replace('-', '−')} dB`;
}

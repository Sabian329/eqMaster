export const GAIN_TICKS = [10, 5, 0, -5, -10] as const;

export const BAND_COLORS = [
  '#ff8c42',
  '#ffb347',
  '#ffd166',
  '#c9e265',
  '#7dd957',
  '#52d1b6',
  '#4ecdc4',
  '#5b9cf6',
  '#7c83fd',
  '#a78bfa',
  '#c084fc',
  '#f472b6',
  '#fb7185',
  '#f97316',
  '#eab308',
  '#84cc16',
] as const;

export const STRIP_LAYOUT = {
  compact: { width: '72px', faderHeight: 118, padding: 1.5, gap: 1.5 },
  default: { width: '82px', faderHeight: 160, padding: 2, gap: 2 },
} as const;

export const GAIN_TICKS = [25, 10, 0, -10, -25] as const;

export const STRIP_LAYOUT = {
  compact: { width: '72px', faderHeight: 118, padding: 1.5, gap: 1.5 },
  default: { width: '82px', faderHeight: 160, padding: 2, gap: 2 },
} as const;

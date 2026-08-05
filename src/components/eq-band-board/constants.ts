import { ui } from '../../theme';

export const GAIN_TICKS = [25, 10, 0, -10, -25] as const;

export const STRIP_LAYOUT = {
  compact: { width: '72px', faderHeight: 118, padding: 1.5, gap: 1.5 },
  default: { width: '82px', faderHeight: 160, padding: 2, gap: 2 },
} as const;

export const STRIP_CHROME = {
  bg: ui.colors.inset,
  border: ui.colors.borderStrong,
  borderCustom: ui.colors.accent,
  labelBg: ui.colors.panelRaised,
  labelBorder: ui.colors.border,
  accent: ui.colors.accent,
  text: ui.colors.text,
  textMuted: ui.colors.textMuted,
} as const;

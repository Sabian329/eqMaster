import type { Suggestion } from '../../types';
import {
  SUGGESTION_GAIN_MAX,
  SUGGESTION_GAIN_MIN,
  clampBipolarGain,
} from '../../utils/suggestionQ';

export { bandColorForIndex } from '../../config/bandColors';

export function gainToTopPercent(gain: number): number {
  return (
    ((SUGGESTION_GAIN_MAX - clampBipolarGain(gain)) /
      (SUGGESTION_GAIN_MAX - SUGGESTION_GAIN_MIN)) *
    100
  );
}

export function topPercentToGain(percent: number): number {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    SUGGESTION_GAIN_MAX -
    (clamped / 100) * (SUGGESTION_GAIN_MAX - SUGGESTION_GAIN_MIN)
  );
}

export function formatGainLabel(item: Suggestion): string {
  if (item.enabled === false || item.gain === null) return 'OFF';
  const sign = item.gain > 0 ? '+' : '';
  return `${sign}${item.gain.toFixed(1)} dB`;
}

export function getFilterTypeLabel(item: Suggestion): string {
  if (item.source === 'custom') return 'Custom';
  const enabled = item.enabled !== false;
  if (item.kind === 'cut') return 'Peak';
  if (item.kind === 'boost' || (item.kind === 'null' && enabled)) return 'Dip';
  return 'Null';
}

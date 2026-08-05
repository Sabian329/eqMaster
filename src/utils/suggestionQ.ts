import type { Suggestion, SuggestionKind } from '../types';

export const SUGGESTION_Q_MIN = 0.3;
export const SUGGESTION_Q_MAX = 12;

export const SUGGESTION_GAIN_MIN = -10;
export const SUGGESTION_GAIN_MAX = 10;

/** @deprecated Use SUGGESTION_GAIN_MIN */
export const SUGGESTION_GAIN_CUT_MIN = SUGGESTION_GAIN_MIN;
/** @deprecated Use SUGGESTION_GAIN_MAX for cuts — bipolar UI allows up to 0 */
export const SUGGESTION_GAIN_CUT_MAX = 0;
/** @deprecated Use SUGGESTION_GAIN_MIN for boosts — bipolar UI allows from 0 */
export const SUGGESTION_GAIN_BOOST_MIN = 0;
/** @deprecated Use SUGGESTION_GAIN_MAX */
export const SUGGESTION_GAIN_BOOST_MAX = SUGGESTION_GAIN_MAX;

export function suggestionKey(item: Pick<Suggestion, 'kind' | 'frequency'>): string {
  return `${item.kind}:${Math.round(item.frequency)}`;
}

export function clampSuggestionQ(q: number): number {
  if (!Number.isFinite(q)) return 1;
  return Math.max(SUGGESTION_Q_MIN, Math.min(SUGGESTION_Q_MAX, q));
}

export function clampBipolarGain(gain: number): number {
  if (!Number.isFinite(gain)) return 0;
  return Math.max(SUGGESTION_GAIN_MIN, Math.min(SUGGESTION_GAIN_MAX, gain));
}

export function clampSuggestionGain(gain: number, kind: SuggestionKind): number {
  if (kind === 'null') return gain;
  return clampBipolarGain(gain);
}

export function gainLimitsForKind(_kind: SuggestionKind): { min: number; max: number } {
  return { min: SUGGESTION_GAIN_MIN, max: SUGGESTION_GAIN_MAX };
}

export function defaultSuggestionEnabled(item: Suggestion): boolean {
  return item.kind !== 'null';
}

export function isSuggestionEnabled(
  item: Suggestion,
  enabledOverrides: Record<string, boolean>,
): boolean {
  const key = suggestionKey(item);
  if (enabledOverrides[key] !== undefined) return enabledOverrides[key];
  return defaultSuggestionEnabled(item);
}

export function defaultBoostGainForDip(deviation: number): number {
  const depth = Math.abs(deviation);
  if (depth >= 8) {
    return Math.min(2, Math.max(0.5, depth - 5));
  }
  return Math.min(3, Math.max(1, depth - 2));
}

export function applySuggestionAdjustments(
  suggestions: Suggestion[],
  qOverrides: Record<string, number>,
  gainOverrides: Record<string, number>,
  enabledOverrides: Record<string, boolean> = {},
): Suggestion[] {
  return suggestions.map((item) => {
    const key = suggestionKey(item);
    const q = qOverrides[key] !== undefined ? clampSuggestionQ(qOverrides[key]) : item.q;
    let gain = item.gain;
    if (gainOverrides[key] !== undefined) {
      gain = clampBipolarGain(gainOverrides[key]);
    } else if (item.kind === 'null' && enabledOverrides[key] === true) {
      gain = clampBipolarGain(
        gainOverrides[key] ?? defaultBoostGainForDip(item.deviation),
      );
    }
    const enabled = isSuggestionEnabled(item, enabledOverrides);
    return { ...item, q, gain, enabled };
  });
}

/** @deprecated Use applySuggestionAdjustments */
export function applySuggestionQOverrides(
  suggestions: Suggestion[],
  overrides: Record<string, number>,
): Suggestion[] {
  return applySuggestionAdjustments(suggestions, overrides, {});
}

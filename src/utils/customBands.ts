import type { ChartBounds, CurvePoint, Suggestion } from '../types';
import { clampBipolarGain } from './suggestionQ';
import { lookupDbAtFrequency } from './curveLookup';

/** Minimum absolute spacing between bands (manual add from chart). */
export const MIN_BAND_SPACING_HZ = 1;

export function frequencyAtCanvasX(
  clientX: number,
  canvas: HTMLCanvasElement,
  bounds: ChartBounds,
): number {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const fraction = Math.max(
    0,
    Math.min(1, (x - bounds.padding.left) / bounds.plotWidth),
  );
  return bounds.fMin * Math.pow(bounds.fMax / bounds.fMin, fraction);
}

export function isBandTooClose(
  frequency: number,
  suggestions: Suggestion[],
  minSpacingHz = MIN_BAND_SPACING_HZ,
): boolean {
  return suggestions.some(
    (item) => Math.abs(item.frequency - frequency) < minSpacingHz,
  );
}

export function createCustomSuggestion(
  frequency: number,
  measuredCurve: CurvePoint[],
  targetCurve: CurvePoint[],
): Suggestion {
  const safeFrequency = Math.max(20, Math.min(20000, frequency));
  const measuredDb = lookupDbAtFrequency(measuredCurve, safeFrequency) ?? 0;
  const targetDb = lookupDbAtFrequency(targetCurve, safeFrequency) ?? 0;
  const deviation = measuredDb - targetDb;
  const kind = deviation >= 0 ? 'cut' : 'boost';
  const initialGain =
    Math.abs(deviation) < 0.25
      ? 0
      : deviation >= 0
        ? -Math.min(6, Math.max(0.5, deviation * 0.6))
        : Math.min(6, Math.max(0.5, Math.abs(deviation) * 0.6));

  return {
    kind,
    frequency: safeFrequency,
    deviation,
    gain: clampBipolarGain(initialGain),
    q: 2,
    note: 'Custom band added from chart.',
    source: 'custom',
    customId:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

export function mergeSuggestions(
  autoSuggestions: Suggestion[],
  customSuggestions: Suggestion[],
): Suggestion[] {
  return [...autoSuggestions, ...customSuggestions].sort(
    (a, b) => a.frequency - b.frequency,
  );
}

export function withoutOverlaySuggestions(suggestions: Suggestion[]): Suggestion[] {
  return suggestions.filter(
    (item) =>
      !(
        item.source === 'custom' &&
        (item.customId === 'eq-overlay-low' || item.customId === 'eq-overlay-high')
      ),
  );
}

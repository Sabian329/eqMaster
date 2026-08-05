import type { Suggestion } from '../types';
import { bandwidthOctavesToQ } from '../utils/format';
import { clampSuggestionQ } from '../utils/suggestionQ';

export type EqShapePresetId = 'auto' | 'softer' | 'sharp';

export interface FixedOverlayBand {
  id: 'eq-overlay-low' | 'eq-overlay-high';
  frequency: number;
  gain: number;
  bandwidthOctaves: number;
  note: string;
}

export interface EqShapePreset {
  id: EqShapePresetId;
  label: string;
  qScale: number;
}

/** Two fixed SOS bands layered on top of Auto EQ (low body + presence). */
export const SOS_OVERLAY_BANDS: FixedOverlayBand[] = [
  {
    id: 'eq-overlay-low',
    frequency: 50,
    gain: 4,
    bandwidthOctaves: 1.5,
    note: 'SOS overlay — low body.',
  },
  {
    id: 'eq-overlay-high',
    frequency: 7000,
    gain: 2,
    bandwidthOctaves: 3,
    note: 'SOS overlay — presence / air.',
  },
];

export const EQ_SHAPE_PRESETS: EqShapePreset[] = [
  { id: 'auto', label: 'Auto', qScale: 1 },
  { id: 'softer', label: 'Softer', qScale: 0.7 },
  { id: 'sharp', label: 'Sharp', qScale: 1.3 },
];

export function getEqShapePreset(id: EqShapePresetId): EqShapePreset {
  return EQ_SHAPE_PRESETS.find((item) => item.id === id) ?? EQ_SHAPE_PRESETS[0];
}

export function isOverlaySuggestion(
  item: Pick<Suggestion, 'source' | 'customId'>,
): boolean {
  return (
    item.source === 'custom' &&
    (item.customId === 'eq-overlay-low' || item.customId === 'eq-overlay-high')
  );
}

export function createOverlaySuggestions(bands: FixedOverlayBand[]): Suggestion[] {
  return bands.map((band) => ({
    kind: band.gain >= 0 ? 'boost' : 'cut',
    frequency: band.frequency,
    deviation: 0,
    gain: band.gain,
    q: clampSuggestionQ(bandwidthOctavesToQ(band.bandwidthOctaves)),
    note: band.note,
    source: 'custom',
    customId: band.id,
    enabled: true,
  }));
}

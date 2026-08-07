import type { SavedPreset, Suggestion } from '../types';
import { buildPresetText } from './preset';

/** Shared by web and Electron renderer (Chromium localStorage). */
const STORAGE_KEY = 'eqmaster.savedPresets';
const MAX_SAVED = 50;

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isSavedPreset(value: unknown): value is SavedPreset {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<SavedPreset>;
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.savedAt === 'string' &&
    typeof item.text === 'string' &&
    typeof item.preamp === 'number' &&
    Array.isArray(item.suggestions)
  );
}

export function loadSavedPresets(): SavedPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedPreset);
  } catch {
    return [];
  }
}

export function writeSavedPresets(items: SavedPreset[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function createSavedPreset(input: {
  name: string;
  preamp: number;
  suggestions: Suggestion[];
  eqAlgorithmVersion?: string;
  savedAt?: string;
}): SavedPreset {
  const savedAt = input.savedAt ?? new Date().toISOString();
  const name = input.name.replace(/[\r\n]+/g, ' ').trim() || 'Untitled preset';
  return {
    id: createId(),
    name,
    savedAt,
    preamp: input.preamp,
    text: buildPresetText(name, input.preamp, input.suggestions),
    suggestions: input.suggestions,
    eqAlgorithmVersion: input.eqAlgorithmVersion,
  };
}

export function prependSavedPreset(
  existing: SavedPreset[],
  next: SavedPreset,
): SavedPreset[] {
  return [next, ...existing.filter((item) => item.id !== next.id)].slice(
    0,
    MAX_SAVED,
  );
}

export function removeSavedPreset(
  existing: SavedPreset[],
  id: string,
): SavedPreset[] {
  return existing.filter((item) => item.id !== id);
}

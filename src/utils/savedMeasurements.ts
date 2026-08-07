import type { MeasurementMeta, MeasurementRun, SavedMeasurement } from '../types';
import { joinMeasurementNameParts } from '../config/measurementNamePrefixes';
import { formatFrequency } from './format';

/** Shared by web and Electron renderer (Chromium localStorage). */
const STORAGE_KEY = 'eqmaster.savedMeasurements';
const MAX_SAVED = 50;

export function formatLocalDateTime(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

export function buildSavedMeasurementName(
  fMin: number,
  fMax: number,
  date: Date | string = new Date(),
): string {
  const when = typeof date === 'string' ? new Date(date) : date;
  const safeWhen = Number.isNaN(when.getTime()) ? new Date() : when;
  return `${formatFrequency(fMin)} – ${formatFrequency(fMax)} · ${formatLocalDateTime(safeWhen)}`;
}

/** First ` · ` segment of a composed name, if it looks like a label. */
export function extractMeasurementPrefix(name: string): string {
  const trimmed = name.replace(/[\r\n]+/g, ' ').trim();
  if (!trimmed) return '';
  const [first = ''] = trimmed.split(' · ');
  const candidate = first.trim();
  if (!candidate || candidate.startsWith('#')) return '';
  if (/^\d+(\.\d+)?\s*(Hz|kHz)$/i.test(candidate)) return '';
  if (/^EQ[Vv]?\d/i.test(candidate)) return '';
  return candidate;
}

export function nextMeasurementNumber(
  existing: SavedMeasurement[],
): number {
  let max = 0;
  for (const item of existing) {
    const value = item.measurementNumber;
    if (typeof value === 'number' && Number.isFinite(value) && value > max) {
      max = value;
    }
  }
  return max + 1;
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isSavedMeasurement(value: unknown): value is SavedMeasurement {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<SavedMeasurement>;
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.savedAt === 'string' &&
    Array.isArray(item.curve) &&
    Array.isArray(item.runs) &&
    item.meta != null &&
    typeof item.meta === 'object'
  );
}

export function loadSavedMeasurements(): SavedMeasurement[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedMeasurement).map((item, index, list) => ({
      ...item,
      prefix: item.prefix || extractMeasurementPrefix(item.name) || undefined,
      measurementNumber:
        item.measurementNumber ?? list.length - index,
    }));
  } catch {
    return [];
  }
}

export function writeSavedMeasurements(items: SavedMeasurement[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function createSavedMeasurement(input: {
  meta: MeasurementMeta;
  curve: { frequency: number; db: number }[];
  runs: MeasurementRun[];
  average: MeasurementRun | null;
  savedAt?: string;
  name?: string;
  prefix?: string;
  measurementNumber: number;
}): SavedMeasurement {
  const savedAt = input.savedAt ?? new Date().toISOString();
  const fMin = input.meta.fMin;
  const fMax = input.meta.fMax;
  const trimmedName = input.name?.replace(/[\r\n]+/g, ' ').trim();
  const prefix =
    input.prefix?.replace(/[\r\n]+/g, ' ').trim() ||
    (trimmedName ? extractMeasurementPrefix(trimmedName) : '') ||
    undefined;
  const numberLabel = `#${input.measurementNumber}`;

  let name = trimmedName;
  if (name) {
    const alreadyHasNumber = name.includes(numberLabel);
    if (prefix && !name.startsWith(prefix)) {
      name = joinMeasurementNameParts(prefix, numberLabel, name);
    } else if (!alreadyHasNumber) {
      if (prefix && name.startsWith(prefix)) {
        const rest = name.slice(prefix.length).replace(/^\s*·\s*/, '');
        name = joinMeasurementNameParts(prefix, numberLabel, rest);
      } else {
        name = joinMeasurementNameParts(numberLabel, name);
      }
    }
  } else {
    name = joinMeasurementNameParts(
      prefix,
      numberLabel,
      buildSavedMeasurementName(fMin, fMax, savedAt),
    );
  }

  return {
    id: createId(),
    name,
    prefix,
    measurementNumber: input.measurementNumber,
    savedAt,
    meta: input.meta,
    curve: input.curve,
    runs: input.runs,
    average: input.average,
  };
}

export function prependSavedMeasurement(
  existing: SavedMeasurement[],
  next: SavedMeasurement,
): SavedMeasurement[] {
  return [next, ...existing.filter((item) => item.id !== next.id)].slice(
    0,
    MAX_SAVED,
  );
}

export function removeSavedMeasurement(
  existing: SavedMeasurement[],
  id: string,
): SavedMeasurement[] {
  return existing.filter((item) => item.id !== id);
}

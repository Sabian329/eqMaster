import type { MeasurementRun } from '../types';
import type { SavedMeasurement } from '../types/savedMeasurement';
import { formatFrequency } from './format';

const STORAGE_KEY = 'room-eq-saved-measurements-v1';
const MAX_SAVED = 40;

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `meas-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatSavedMeasurementName(
  fMin: number,
  fMax: number,
  createdAt: string | Date,
  label?: string,
): string {
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = Number.isNaN(date.getTime())
    ? 'unknown time'
    : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const range = `${formatFrequency(fMin)} – ${formatFrequency(fMax)} · ${stamp}`;
  const trimmedLabel = label?.replace(/\s+/g, ' ').trim();
  return trimmedLabel ? `${trimmedLabel} · ${range}` : range;
}

function cloneRuns(runs: MeasurementRun[]): MeasurementRun[] {
  return runs.map((run) => ({
    ...run,
    rawCurve: run.rawCurve.map((point) => ({ ...point })),
    curve: run.curve.map((point) => ({ ...point })),
    suggestions: run.suggestions.map((suggestion) => ({ ...suggestion })),
    meta: { ...run.meta, trackSettings: { ...run.meta.trackSettings } },
  }));
}

export function createSavedMeasurement(
  runs: MeasurementRun[],
  options?: { smoothing?: number; label?: string },
): SavedMeasurement | null {
  if (!runs.length) return null;

  const meta = runs[runs.length - 1].meta;
  const createdAt = new Date().toISOString();
  const fMin = meta.fMin;
  const fMax = meta.fMax;
  const smoothing = options?.smoothing ?? meta.smoothing;
  const label = options?.label?.replace(/\s+/g, ' ').trim() || undefined;

  return {
    id: createId(),
    name: formatSavedMeasurementName(fMin, fMax, createdAt, label),
    label,
    createdAt,
    fMin,
    fMax,
    smoothing,
    runs: cloneRuns(runs),
    recorderMode: meta.recorderMode || 'live',
  };
}

function isValidSavedMeasurement(value: unknown): value is SavedMeasurement {
  if (!value || typeof value !== 'object') return false;
  const item = value as SavedMeasurement;
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.createdAt === 'string' &&
    typeof item.fMin === 'number' &&
    typeof item.fMax === 'number' &&
    Array.isArray(item.runs) &&
    item.runs.length > 0
  );
}

function normalizeList(value: unknown): SavedMeasurement[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isValidSavedMeasurement).slice(0, MAX_SAVED);
}

async function readFromElectron(): Promise<SavedMeasurement[] | null> {
  if (!window.electronAPI?.readSavedMeasurements) return null;
  try {
    const data = await window.electronAPI.readSavedMeasurements();
    return normalizeList(data);
  } catch {
    return null;
  }
}

async function writeToElectron(items: SavedMeasurement[]): Promise<boolean> {
  if (!window.electronAPI?.writeSavedMeasurements) return false;
  try {
    await window.electronAPI.writeSavedMeasurements(items);
    return true;
  } catch {
    return false;
  }
}

function readFromLocalStorage(): SavedMeasurement[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return normalizeList(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

function writeToLocalStorage(items: SavedMeasurement[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_SAVED)));
}

export async function loadSavedMeasurements(): Promise<SavedMeasurement[]> {
  const fromElectron = await readFromElectron();
  if (fromElectron) return fromElectron;
  return readFromLocalStorage();
}

export async function persistSavedMeasurements(
  items: SavedMeasurement[],
): Promise<SavedMeasurement[]> {
  const next = items.slice(0, MAX_SAVED);
  const wroteElectron = await writeToElectron(next);
  if (!wroteElectron) {
    writeToLocalStorage(next);
  } else {
    // Keep a localStorage mirror so web-export / recovery stays possible.
    try {
      writeToLocalStorage(next);
    } catch {
      // ignore quota on mirror
    }
  }
  return next;
}

export async function addSavedMeasurement(
  existing: SavedMeasurement[],
  entry: SavedMeasurement,
): Promise<SavedMeasurement[]> {
  const next = [entry, ...existing.filter((item) => item.id !== entry.id)];
  return persistSavedMeasurements(next);
}

export async function removeSavedMeasurement(
  existing: SavedMeasurement[],
  id: string,
): Promise<SavedMeasurement[]> {
  return persistSavedMeasurements(existing.filter((item) => item.id !== id));
}

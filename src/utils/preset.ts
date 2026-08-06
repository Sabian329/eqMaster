import type { Suggestion } from '../types';
import type { EqAlgorithmVersion } from '../config/eqAlgorithms';
import { getEqAlgorithm } from '../config/eqAlgorithms';
import { clampSuggestionQ } from './suggestionQ';
import { compactNumber, qToBandwidthOctaves } from './format';

function formatPresetDate(value?: string | Date | null): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return formatPresetDateParts(new Date());
  }
  return formatPresetDateParts(date);
}

function formatPresetDateParts(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatPresetSmoothing(smoothing: number): string {
  if (smoothing <= 0) return 'RAW';
  return `1/${smoothing}`;
}

/** Dynamic preset name: EQ {algorithm} · {label?} · {smoothing} · {date} */
export function buildDynamicPresetName(options: {
  algorithmVersion: EqAlgorithmVersion;
  smoothing: number;
  date?: string | Date | null;
  label?: string | null;
}): string {
  const algorithm = getEqAlgorithm(options.algorithmVersion).label;
  const smoothingLabel = formatPresetSmoothing(options.smoothing);
  const dateLabel = formatPresetDate(options.date);
  const label = options.label?.replace(/\s+/g, ' ').trim();
  const parts =
    options.algorithmVersion === 'overview'
      ? ['Overview']
      : ['EQ', algorithm];
  if (label) parts.push(label);
  parts.push(smoothingLabel, dateLabel);
  return parts.join(' · ');
}

export function buildPresetText(
  name: string,
  preamp: number,
  suggestions: Suggestion[],
): string {
  const safeName =
    name.replace(/[\r\n]+/g, ' ').trim() || 'Room EQ';
  const safePreamp = Number.isFinite(preamp)
    ? Math.max(-30, Math.min(12, preamp))
    : 0;

  const lines = [
    `Name: ${safeName}`,
    `Preamp: ${compactNumber(safePreamp, 2)} dB`,
  ];

  suggestions.forEach((item, index) => {
    const hasGain = item.gain !== null && item.gain !== 0;
    const enabled = item.enabled !== false && hasGain ? 'ON' : 'OFF';
    const frequency = Math.max(1, Math.round(item.frequency));
    const gain = hasGain ? Number(item.gain) : 0;
    const q = clampSuggestionQ(item.q);
    const bandwidthOctaves = qToBandwidthOctaves(q);

    lines.push(
      `Filter ${index + 1}:  ${enabled}  PK  Fc ${frequency} Hz  ` +
        `Gain ${compactNumber(gain, 2)} dB  BW Oct ${compactNumber(bandwidthOctaves, 3)}`,
    );
  });

  return lines.join('\n');
}

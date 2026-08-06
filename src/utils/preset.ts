import type { EqAlgorithmVersion } from '../config/eqAlgorithms';
import type { Suggestion } from '../types';
import { clampSuggestionQ } from './suggestionQ';
import { compactNumber, qToBandwidthOctaves } from './format';

/** e.g. EQV3_1/12_2026-08-06 */
export function buildDynamicPresetName(
  algorithmVersion: EqAlgorithmVersion,
  smoothing: number,
  date: Date | string = new Date(),
): string {
  const when = typeof date === 'string' ? new Date(date) : date;
  const safeWhen = Number.isNaN(when.getTime()) ? new Date() : when;
  const y = safeWhen.getFullYear();
  const m = String(safeWhen.getMonth() + 1).padStart(2, '0');
  const day = String(safeWhen.getDate()).padStart(2, '0');
  const smoothLabel = smoothing > 0 ? `1/${smoothing}` : 'RAW';
  return `EQ${algorithmVersion.toUpperCase()}_${smoothLabel}_${y}-${m}-${day}`;
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

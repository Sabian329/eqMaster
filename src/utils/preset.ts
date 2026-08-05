import type { Suggestion } from '../types';
import { compactNumber, qToBandwidthOctaves } from './format';

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
    const bandwidth = Math.max(
      0.01,
      Math.min(8, qToBandwidthOctaves(item.q)),
    );

    lines.push(
      `Filter ${index + 1}:  ${enabled}  PK  Fc ${frequency} Hz  ` +
        `Gain ${compactNumber(gain, 2)} dB  BW Oct ${compactNumber(bandwidth, 3)}`,
    );
  });

  return lines.join('\n');
}

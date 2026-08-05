import { lookupDbAtFrequency } from '../../../utils/curveLookup';

export { lookupDbAtFrequency };

export function buildTooltipHtml(
  frequency: number,
  measuredDb: number,
  correctedDb: number | null,
  verifiedDb: number | null,
  targetDb: number | null,
  formatFrequency: (f: number) => string,
  formatDb: (db: number) => string,
): string {
  let html = `<strong>${formatFrequency(frequency)}</strong><br>Measured: ${formatDb(measuredDb)}`;
  if (correctedDb !== null) html += `<br>After EQ: ${formatDb(correctedDb)}`;
  if (verifiedDb !== null) html += `<br>Verified: ${formatDb(verifiedDb)}`;
  if (targetDb !== null) html += `<br>Target: ${formatDb(targetDb)}`;
  return html;
}

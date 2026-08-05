import { MIN_TONAL_ERROR_DB, MIN_TONAL_WIDTH_OCTAVES } from './constants';
import type { PreparedMeasurement, ShelfCandidate } from './types';
import { detectTonalCandidates } from './tonalCandidates';

export function detectShelfCandidates(prepared: PreparedMeasurement): ShelfCandidate[] {
  const tonal = detectTonalCandidates(prepared);
  const shelves: ShelfCandidate[] = [];

  for (const segment of tonal) {
    if (segment.reason !== 'low-frequency-tilt' && segment.reason !== 'high-frequency-tilt') {
      continue;
    }
    if (Math.abs(segment.errorDb) < MIN_TONAL_ERROR_DB) continue;
    if (segment.bandwidthOctaves < MIN_TONAL_WIDTH_OCTAVES) continue;

    if (segment.reason === 'low-frequency-tilt' && segment.frequency < 250) {
      shelves.push({
        type: 'LS',
        frequency: Math.max(40, segment.frequency * 0.7),
        errorDb: segment.errorDb,
        reason: segment.reason,
        reliability: segment.reliability,
      });
    }

    if (segment.reason === 'high-frequency-tilt' && segment.frequency > 6_000) {
      shelves.push({
        type: 'HS',
        frequency: Math.min(12_000, segment.frequency),
        errorDb: segment.errorDb,
        reason: segment.reason,
        reliability: segment.reliability,
      });
    }
  }

  return shelves.sort((a, b) => Math.abs(b.errorDb) - Math.abs(a.errorDb));
}

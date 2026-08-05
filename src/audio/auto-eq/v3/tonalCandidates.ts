import {
  MIN_PROMINENCE_DB,
  MIN_RELIABILITY,
  MIN_TONAL_ERROR_DB,
  MIN_TONAL_WIDTH_OCTAVES,
} from './constants';
import type { FilterReason, PreparedMeasurement, TonalCandidate } from './types';

function regionHasBlockingLocalResonances(
  prepared: PreparedMeasurement,
  start: number,
  end: number,
  centerFrequency: number,
): boolean {
  // Above 1 kHz, broad excess often coexists with local peaks — allow tonal/shelf
  // candidates and let overlap checks prevent duplicate correction.
  if (centerFrequency >= 1_000) return false;

  const { narrowResidual } = prepared;
  let peakCount = 0;
  let samples = 0;

  for (let index = start + 1; index < end - 1; index += 1) {
    samples += 1;
    const narrowDb = narrowResidual[index].db;
    if (narrowDb < MIN_PROMINENCE_DB) continue;

    if (
      narrowDb > narrowResidual[index - 1].db &&
      narrowDb > narrowResidual[index + 1].db
    ) {
      peakCount += 1;
    }
  }

  return peakCount > 0 && peakCount / Math.max(samples, 1) > 0.08;
}

export function detectTonalCandidates(prepared: PreparedMeasurement): TonalCandidate[] {
  const candidates: TonalCandidate[] = [];
  const { tonalError, broad, reliability } = prepared;
  let start = 0;

  while (start < tonalError.length) {
    const sign = Math.sign(tonalError[start].db);
    if (sign === 0 || Math.abs(tonalError[start].db) < MIN_TONAL_ERROR_DB) {
      start += 1;
      continue;
    }

    let end = start + 1;
    while (
      end < tonalError.length &&
      Math.sign(tonalError[end].db) === sign &&
      Math.abs(tonalError[end].db) >= MIN_TONAL_ERROR_DB * 0.8
    ) {
      end += 1;
    }

    const bandwidthOctaves = Math.log2(
      broad[Math.min(end - 1, broad.length - 1)].frequency /
        broad[start].frequency,
    );

    const slice = tonalError.slice(start, end);
    const averageError =
      slice.reduce((sum, point) => sum + point.db, 0) / Math.max(slice.length, 1);
    const averageRel =
      slice.reduce((sum, _, index) => sum + reliability[start + index], 0) /
      Math.max(slice.length, 1);

    const centerIndex = Math.floor((start + end - 1) / 2);
    const centerFrequency = broad[centerIndex].frequency;

    if (
      bandwidthOctaves >= MIN_TONAL_WIDTH_OCTAVES &&
      Math.abs(averageError) >= MIN_TONAL_ERROR_DB &&
      averageRel >= MIN_RELIABILITY &&
      !regionHasBlockingLocalResonances(
        prepared,
        start,
        end,
        centerFrequency,
      )
    ) {
      const reason: FilterReason =
        centerFrequency < 250
          ? 'low-frequency-tilt'
          : centerFrequency > 6_000
            ? 'high-frequency-tilt'
            : 'broad-tonal-error';

      candidates.push({
        frequency: centerFrequency,
        errorDb: averageError,
        bandwidthOctaves,
        reason,
        reliability: averageRel,
      });
    }

    start = end;
  }

  return candidates.sort((a, b) => Math.abs(b.errorDb) - Math.abs(a.errorDb));
}

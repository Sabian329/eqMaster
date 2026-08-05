import {
  MIN_PROMINENCE_DB,
  MIN_RELIABILITY,
  NULL_DEPTH_DB,
  NULL_MAX_BANDWIDTH_OCT,
} from './constants';
import { clamp, frequencyWeight, qFromBandwidthOctaves } from './math';
import type { FilterReason, PreparedMeasurementGrid, ResonanceCandidate } from './types';

function findHalfHeightBounds(
  values: number[],
  frequencies: number[],
  centerIndex: number,
  halfHeight: number,
): { lowerFrequency: number; upperFrequency: number } {
  const sign = Math.sign(values[centerIndex]);
  let left = centerIndex;
  let right = centerIndex;

  while (
    left > 0 &&
    Math.sign(values[left - 1]) === sign &&
    Math.abs(values[left - 1]) >= halfHeight
  ) {
    left -= 1;
  }

  while (
    right < values.length - 1 &&
    Math.sign(values[right + 1]) === sign &&
    Math.abs(values[right + 1]) >= halfHeight
  ) {
    right += 1;
  }

  return {
    lowerFrequency: frequencies[left],
    upperFrequency: frequencies[right],
  };
}

export function detectResonances(prepared: PreparedMeasurementGrid): ResonanceCandidate[] {
  const { detailed, target, narrowResidual, reliability, repeatabilityDb, measurementCount } =
    prepared;
  const candidates: ResonanceCandidate[] = [];

  for (let index = 1; index < detailed.length - 1; index += 1) {
    const frequency = detailed[index].frequency;
    const narrowDb = narrowResidual[index].db;
    const errorDb = detailed[index].db - target[index].db;
    const rel = reliability[index];

    const isPeak =
      narrowDb > narrowResidual[index - 1].db &&
      narrowDb > narrowResidual[index + 1].db &&
      errorDb >= MIN_PROMINENCE_DB;

    const isNull =
      narrowDb < narrowResidual[index - 1].db &&
      narrowDb < narrowResidual[index + 1].db &&
      errorDb <= -NULL_DEPTH_DB;

    if (!isPeak && !isNull) continue;

    const prominenceDb = isPeak ? narrowDb : Math.abs(errorDb);
    if (prominenceDb < MIN_PROMINENCE_DB && !isNull) continue;
    if (rel < MIN_RELIABILITY && measurementCount > 1) continue;

    const bounds = findHalfHeightBounds(
      narrowResidual.map((point) => point.db),
      detailed.map((point) => point.frequency),
      index,
      prominenceDb * 0.5,
    );

    const bandwidthOctaves = Math.log2(
      bounds.upperFrequency / Math.max(bounds.lowerFrequency, 1),
    );
    const q = qFromBandwidthOctaves(bandwidthOctaves);

    if (isNull && bandwidthOctaves < NULL_MAX_BANDWIDTH_OCT) {
      candidates.push({
        frequency,
        prominenceDb,
        bandwidthOctaves,
        q,
        score: prominenceDb * rel,
        reason: 'modal-resonance',
        reliability: rel,
        isNull: true,
      });
      continue;
    }

    if (isNull) continue;

    const repeatabilityFactor = clamp(1.5 - repeatabilityDb[index] / 3, 0.35, 1.25);
    const score =
      prominenceDb *
      Math.sqrt(Math.max(bandwidthOctaves, 1 / 24)) *
      rel *
      repeatabilityFactor *
      frequencyWeight(frequency);

    const reason: FilterReason =
      measurementCount >= 3 && repeatabilityDb[index] < 1 ? 'repeated-peak' : 'modal-resonance';

    candidates.push({
      frequency,
      prominenceDb,
      bandwidthOctaves,
      q,
      score,
      reason,
      reliability: rel,
      isNull: false,
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const deduped: ResonanceCandidate[] = [];
  for (const candidate of candidates) {
    const tooClose = deduped.some(
      (existing) =>
        Math.abs(Math.log2(existing.frequency / candidate.frequency)) < 1 / 24,
    );
    if (!tooClose) deduped.push(candidate);
  }

  return deduped;
}

export function detectBroadTonalErrors(
  prepared: PreparedMeasurementGrid,
): Array<{ frequency: number; errorDb: number; bandwidthOctaves: number; reason: FilterReason }> {
  const segments: Array<{
    frequency: number;
    errorDb: number;
    bandwidthOctaves: number;
    reason: FilterReason;
  }> = [];

  const { tonalError, broad, reliability } = prepared;
  let start = 0;

  while (start < tonalError.length) {
    const sign = Math.sign(tonalError[start].db);
    if (sign === 0 || Math.abs(tonalError[start].db) < 1.5) {
      start += 1;
      continue;
    }

    let end = start + 1;
    while (
      end < tonalError.length &&
      Math.sign(tonalError[end].db) === sign &&
      Math.abs(tonalError[end].db) >= 1.0
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
      bandwidthOctaves >= 0.75 &&
      Math.abs(averageError) >= 1.5 &&
      averageRel >= 0.45
    ) {
      const reason: FilterReason =
        centerFrequency < 250
          ? 'low-frequency-tilt'
          : centerFrequency > 6_000
            ? 'high-frequency-tilt'
            : 'broad-tonal-error';

      segments.push({
        frequency: centerFrequency,
        errorDb: averageError,
        bandwidthOctaves,
        reason,
      });
    }

    start = end;
  }

  return segments.sort((a, b) => Math.abs(b.errorDb) - Math.abs(a.errorDb));
}

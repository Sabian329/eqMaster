import {
  MIN_PROMINENCE_DB,
  MIN_RELIABILITY,
  NULL_DEPTH_DB,
  NULL_MAX_BANDWIDTH_OCT,
} from './constants';
import { clamp, frequencyWeight, qFromBandwidthOctaves } from './math';
import { singleMeasurementReliability } from './prepareMeasurement';
import type { FilterReason, PreparedMeasurement, ResonanceCandidate } from './types';

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

export function detectResonanceCandidates(prepared: PreparedMeasurement): ResonanceCandidate[] {
  const { detailed, target, narrowResidual, reliability, repeatabilityDb, measurementCount } =
    prepared;
  const candidates: ResonanceCandidate[] = [];
  const narrowValues = narrowResidual.map((point) => point.db);
  const frequencies = detailed.map((point) => point.frequency);

  for (let index = 1; index < detailed.length - 1; index += 1) {
    const frequency = detailed[index].frequency;
    const narrowDb = narrowResidual[index].db;
    const errorDb = detailed[index].db - target[index].db;
    const rel = reliability[index];

    const isPeak =
      narrowDb > narrowResidual[index - 1].db &&
      narrowDb > narrowResidual[index + 1].db &&
      errorDb >= MIN_PROMINENCE_DB;

    const isPotentialNull =
      narrowDb < narrowResidual[index - 1].db &&
      narrowDb < narrowResidual[index + 1].db &&
      errorDb <= -NULL_DEPTH_DB;

    if (!isPeak && !isPotentialNull) continue;

    const prominenceDb = isPeak ? narrowDb : Math.abs(errorDb);
    if (prominenceDb < MIN_PROMINENCE_DB && !isPotentialNull) continue;
    if (rel < MIN_RELIABILITY && measurementCount > 1) continue;

    const bounds = findHalfHeightBounds(narrowValues, frequencies, index, prominenceDb * 0.5);
    const bandwidthOctaves = Math.log2(
      bounds.upperFrequency / Math.max(bounds.lowerFrequency, 1),
    );
    const q = qFromBandwidthOctaves(bandwidthOctaves);

    if (isPotentialNull && bandwidthOctaves < NULL_MAX_BANDWIDTH_OCT) {
      candidates.push({
        frequency,
        prominenceDb,
        bandwidthOctaves,
        q,
        score: prominenceDb * rel,
        reason: 'local-resonance',
        reliability: rel,
        isPotentialNull: true,
      });
      continue;
    }

    if (isPotentialNull) continue;

    const repeatabilityFactor = clamp(1.5 - repeatabilityDb[index] / 3, 0.35, 1.25);
    const singleFactor = singleMeasurementReliability(frequency, measurementCount);
    const score =
      prominenceDb *
      Math.sqrt(Math.max(bandwidthOctaves, 1 / 24)) *
      rel *
      repeatabilityFactor *
      singleFactor *
      frequencyWeight(frequency);

    const isHighConfidenceRepeated =
      measurementCount >= 3 &&
      repeatabilityDb[index] < 1 &&
      rel > 0.75 &&
      singleFactor > 0.75;

    const reason: FilterReason = isHighConfidenceRepeated
      ? 'repeated-resonance'
      : 'local-resonance';

    candidates.push({
      frequency,
      prominenceDb,
      bandwidthOctaves,
      q,
      score,
      reason,
      reliability: rel,
      isPotentialNull: false,
      isHighConfidenceRepeated,
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

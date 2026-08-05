import {
  FREQUENCY_OFFSETS_OCTAVES,
  GAIN_MULTIPLIERS,
  MAX_HIGH_SHELF,
  MAX_LOW_SHELF,
  MAX_PK_RESONANCE,
  MAX_PK_TONAL,
  Q_MULTIPLIERS,
} from './constants';
import { clampFilterGain, clampFilterQ } from './frequencyLimits';
import { canBoostAtFrequency, clampFrequencyToOptions } from './measurement';
import type {
  AutoEqOptions,
  FilterCandidate,
  FilterReason,
  GeneratedEqFilter,
  PreparedMeasurementGrid,
  ResonanceCandidate,
} from './types';

let candidateCounter = 0;

export function resetCandidateCounter(): void {
  candidateCounter = 0;
}

export function createFilterId(): string {
  candidateCounter += 1;
  return `filter-${candidateCounter}`;
}

function createCandidateVariants(
  type: GeneratedEqFilter['type'],
  frequency: number,
  baseGainDb: number,
  baseQ: number,
  reason: FilterReason,
  confidence: number,
  prepared: PreparedMeasurementGrid,
  options: AutoEqOptions,
): FilterCandidate[] {
  const candidates: FilterCandidate[] = [];

  for (const octaveOffset of FREQUENCY_OFFSETS_OCTAVES) {
    const candidateFrequency = clampFrequencyToOptions(
      frequency * 2 ** octaveOffset,
      options,
    );

    const isBoost = baseGainDb > 0;
    if (isBoost && !canBoostAtFrequency(prepared, candidateFrequency, options)) {
      continue;
    }

    for (const qMultiplier of Q_MULTIPLIERS) {
      const q = clampFilterQ(baseQ * qMultiplier, candidateFrequency, baseGainDb, type);

      for (const gainMultiplier of GAIN_MULTIPLIERS) {
        const rawGain = baseGainDb * gainMultiplier;
        const gainDb = clampFilterGain(rawGain, candidateFrequency, type);
        if (Math.abs(gainDb) < 0.25) continue;

        candidates.push({
          type,
          frequency: candidateFrequency,
          gainDb,
          q,
          reason,
          confidence,
        });
      }
    }
  }

  return candidates;
}

export function generateResonanceCandidates(
  resonances: ResonanceCandidate[],
  prepared: PreparedMeasurementGrid,
  options: AutoEqOptions,
): FilterCandidate[] {
  const candidates: FilterCandidate[] = [];

  for (const resonance of resonances.slice(0, MAX_PK_RESONANCE * 2)) {
    if (resonance.isNull) continue;

    const measuredError =
      prepared.detailed.find(
        (point) => Math.abs(Math.log2(point.frequency / resonance.frequency)) < 1 / 48,
      )?.db ?? 0;
    const targetDb =
      prepared.target.find(
        (point) => Math.abs(Math.log2(point.frequency / resonance.frequency)) < 1 / 48,
      )?.db ?? 0;
    const excess = measuredError - targetDb;
    if (excess < 1.5) continue;

    const cutGain = clampFilterGain(-excess * 0.75, resonance.frequency, 'PK');
    candidates.push(
      ...createCandidateVariants(
        'PK',
        resonance.frequency,
        cutGain,
        resonance.q,
        resonance.reason,
        resonance.reliability,
        prepared,
        options,
      ),
    );
  }

  return candidates;
}

export function generateTonalCandidates(
  tonalSegments: Array<{
    frequency: number;
    errorDb: number;
    bandwidthOctaves: number;
    reason: FilterReason;
  }>,
  prepared: PreparedMeasurementGrid,
  options: AutoEqOptions,
): FilterCandidate[] {
  const candidates: FilterCandidate[] = [];

  for (const segment of tonalSegments.slice(0, MAX_PK_TONAL + MAX_LOW_SHELF + MAX_HIGH_SHELF)) {
    const gainDb = clampFilterGain(-segment.errorDb * 0.65, segment.frequency, 'PK');
    const q = clampFilterQ(
      Math.max(0.5, 1 / Math.max(segment.bandwidthOctaves, 0.35)),
      segment.frequency,
      gainDb,
      'PK',
    );

    if (segment.reason === 'low-frequency-tilt' && segment.frequency < 250) {
      candidates.push({
        type: 'LS',
        frequency: clampFrequencyToOptions(Math.max(40, segment.frequency * 0.7), options),
        gainDb: clampFilterGain(-segment.errorDb * 0.55, segment.frequency, 'LS'),
        q: 0.707,
        reason: segment.reason,
        confidence: 0.7,
      });
      continue;
    }

    if (segment.reason === 'high-frequency-tilt' && segment.frequency > 6_000) {
      candidates.push({
        type: 'HS',
        frequency: clampFrequencyToOptions(Math.min(12_000, segment.frequency), options),
        gainDb: clampFilterGain(-segment.errorDb * 0.5, segment.frequency, 'HS'),
        q: 0.707,
        reason: segment.reason,
        confidence: 0.65,
      });
      continue;
    }

    candidates.push(
      ...createCandidateVariants(
        'PK',
        segment.frequency,
        gainDb,
        q,
        segment.reason,
        0.65,
        prepared,
        options,
      ),
    );
  }

  return candidates;
}

export function candidateToFilter(candidate: FilterCandidate): GeneratedEqFilter {
  const bandwidth = candidate.type === 'PK' ? 1 / Math.max(candidate.q, 0.1) : 1;
  const fromHz = candidate.frequency / 2 ** (bandwidth / 2);
  const toHz = candidate.frequency * 2 ** (bandwidth / 2);

  return {
    id: createFilterId(),
    type: candidate.type,
    frequency: candidate.frequency,
    gainDb: candidate.gainDb,
    q: candidate.q,
    enabled: true,
    confidence: candidate.confidence,
    improvementPercent: 0,
    affectedRange: { fromHz, toHz },
    reason: candidate.reason,
  };
}

export function cloneFilter(filter: GeneratedEqFilter): GeneratedEqFilter {
  return { ...filter, affectedRange: { ...filter.affectedRange } };
}

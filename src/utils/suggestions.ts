import type { EqStrategyId } from '../config/eqStrategies';
import type { CurvePoint, Suggestion } from '../types';

type Candidate = {
  index: number;
  frequency: number;
  deviation: number;
  kind: 'cut' | 'boost';
  score: number;
  q: number;
};

const SELECTION_PASSES = [
  { thresholdScale: 1, minSpacing: 1.22, radius: 5 },
  { thresholdScale: 0.72, minSpacing: 1.16, radius: 4 },
  { thresholdScale: 0.52, minSpacing: 1.11, radius: 3 },
  { thresholdScale: 0.38, minSpacing: 1.07, radius: 3 },
] as const;

const MIN_PEAK_DB = 1.2;
const MIN_DIP_DB = -1.2;

function estimateQ(curve: CurvePoint[], index: number, deviation: number): number {
  const half = deviation / 2;
  let left = index;
  let right = index;

  if (deviation > 0) {
    while (left > 0 && curve[left].db > half) left--;
    while (right < curve.length - 1 && curve[right].db > half) right++;
  } else {
    while (left > 0 && curve[left].db < half) left--;
    while (right < curve.length - 1 && curve[right].db < half) right++;
  }

  const width = curve[right].frequency - curve[left].frequency;
  if (width <= 0) return 1;
  return Math.max(0.3, Math.min(12, curve[index].frequency / width));
}

function peakThresholdHz(frequency: number, strategy: EqStrategyId, scale = 1): number {
  let base: number;
  if (strategy === 'fit') base = frequency < 250 ? 5 : 3;
  else if (strategy === 'resonance') base = frequency < 200 ? 7 : 4;
  else base = 3;

  return Math.max(MIN_PEAK_DB, base * scale);
}

function dipThresholdHz(frequency: number, strategy: EqStrategyId, scale = 1): number {
  let base: number;
  if (strategy === 'fit' && frequency < 400) base = -3;
  else base = -4;

  return Math.min(MIN_DIP_DB, base * scale);
}

function shouldSkipPeakCut(
  frequency: number,
  deviation: number,
  q: number,
  strategy: EqStrategyId,
): boolean {
  if (strategy !== 'resonance') return false;
  if (frequency >= 250) return false;
  if (deviation >= 8) return false;
  return q < 2.2;
}

function computeCutGain(
  frequency: number,
  deviation: number,
  strategy: EqStrategyId,
): number {
  const base = -Math.min(10, Math.max(1, deviation - 1));

  if (strategy === 'balanced') return base;

  if (strategy === 'fit') {
    let gain = base * 0.58;
    if (frequency < 250) gain *= 0.48;
    if (frequency < 120) gain *= 0.72;
    const cap = frequency < 120 ? -5.5 : frequency < 250 ? -7 : -9;
    return Math.max(cap, gain);
  }

  let gain = base * 0.85;
  if (frequency < 200) gain *= 0.55;
  return Math.max(frequency < 150 ? -6 : -8, gain);
}

function computeBoostGain(deviation: number, frequency: number, strategy: EqStrategyId): number {
  const depth = Math.abs(deviation);
  const deepDip = deviation <= -8;

  let gain = deepDip
    ? Math.min(2, Math.max(0.5, depth - 5))
    : Math.min(3, Math.max(1, depth - 2));

  if (strategy === 'fit' && frequency < 400) {
    gain = Math.min(4, gain * 1.35);
  }

  if (strategy === 'resonance' && frequency < 300) {
    gain = Math.min(3.5, gain * 1.2);
  }

  return gain;
}

function scoreForCandidate(
  kind: 'cut' | 'boost',
  deviation: number,
  frequency: number,
  strategy: EqStrategyId,
): number {
  if (kind === 'cut') {
    let score = deviation;
    if (strategy === 'fit' && frequency < 250) score *= 0.55;
    if (strategy === 'resonance' && frequency < 200) score *= 0.35;
    return score;
  }

  let score = Math.abs(deviation) * 0.75;
  if (strategy === 'fit' && frequency < 400) score *= 1.35;
  if (strategy === 'resonance' && frequency < 350) score *= 1.25;
  return score;
}

function adjustQForStrategy(
  q: number,
  frequency: number,
  kind: 'cut' | 'boost',
  strategy: EqStrategyId,
): number {
  if (strategy === 'fit' && kind === 'cut' && frequency < 300) {
    return Math.max(0.45, Math.min(q, q * 0.82));
  }
  if (strategy === 'resonance' && kind === 'cut' && frequency < 250) {
    return Math.max(1.8, q);
  }
  return q;
}

function isLocalExtremum(
  curve: CurvePoint[],
  index: number,
  radius: number,
  kind: 'cut' | 'boost',
): boolean {
  const point = curve[index];
  for (let j = index - radius; j <= index + radius; j++) {
    if (j === index) continue;
    if (kind === 'cut' && curve[j].db > point.db) return false;
    if (kind === 'boost' && curve[j].db < point.db) return false;
  }
  return true;
}

function findCandidates(
  curve: CurvePoint[],
  strategy: EqStrategyId,
  radius: number,
  thresholdScale: number,
): Candidate[] {
  const candidates: Candidate[] = [];

  for (let i = radius; i < curve.length - radius; i++) {
    const point = curve[i];
    if (point.frequency < 25 || point.frequency > 18000) continue;

    const qEstimate = estimateQ(curve, i, point.db);

    if (
      isLocalExtremum(curve, i, radius, 'cut') &&
      point.db >= peakThresholdHz(point.frequency, strategy, thresholdScale)
    ) {
      if (shouldSkipPeakCut(point.frequency, point.db, qEstimate, strategy)) {
        continue;
      }
      candidates.push({
        index: i,
        frequency: point.frequency,
        deviation: point.db,
        kind: 'cut',
        score: scoreForCandidate('cut', point.db, point.frequency, strategy),
        q: qEstimate,
      });
    }

    if (
      isLocalExtremum(curve, i, radius, 'boost') &&
      point.db <= dipThresholdHz(point.frequency, strategy, thresholdScale)
    ) {
      candidates.push({
        index: i,
        frequency: point.frequency,
        deviation: point.db,
        kind: 'boost',
        score: scoreForCandidate('boost', point.db, point.frequency, strategy),
        q: qEstimate,
      });
    }
  }

  return candidates;
}

function isTooClose(frequency: number, selected: Candidate[], minSpacing: number): boolean {
  return selected.some((item) => {
    const ratio =
      Math.max(item.frequency, frequency) / Math.min(item.frequency, frequency);
    return ratio < minSpacing;
  });
}

function mergeCandidates(
  selected: Candidate[],
  pool: Candidate[],
  maxBands: number,
  minSpacing: number,
): Candidate[] {
  const next = [...selected];
  const usedIndices = new Set(next.map((item) => item.index));

  for (const candidate of pool) {
    if (next.length >= maxBands) break;
    if (usedIndices.has(candidate.index)) continue;
    if (isTooClose(candidate.frequency, next, minSpacing)) continue;
    next.push(candidate);
    usedIndices.add(candidate.index);
  }

  return next;
}

function selectCandidates(
  curve: CurvePoint[],
  strategy: EqStrategyId,
  maxBands: number,
): Candidate[] {
  let selected: Candidate[] = [];

  for (const pass of SELECTION_PASSES) {
    if (selected.length >= maxBands) break;

    const pool = findCandidates(
      curve,
      strategy,
      pass.radius,
      pass.thresholdScale,
    ).sort((a, b) => b.score - a.score);

    selected = mergeCandidates(selected, pool, maxBands, pass.minSpacing);
  }

  return selected;
}

function candidateToSuggestion(item: Candidate, strategy: EqStrategyId): Suggestion {
  const q = adjustQForStrategy(item.q, item.frequency, item.kind, strategy);

  if (item.kind === 'cut') {
    const gain = computeCutGain(item.frequency, item.deviation, strategy);
    return {
      kind: 'cut',
      frequency: item.frequency,
      deviation: item.deviation,
      gain,
      q,
      note:
        strategy === 'fit'
          ? 'Gentle cut — partial correction. Add a custom band to recover bass if needed.'
          : 'Try a cut first. Set filter width based on the chart and run a verification measurement.',
    };
  }

  const gain = computeBoostGain(item.deviation, item.frequency, strategy);
  const deepDip = item.deviation <= -8;
  return {
    kind: 'boost',
    frequency: item.frequency,
    deviation: item.deviation,
    gain,
    q,
    note: deepDip
      ? 'Deep dip — start with a small boost. If headroom is limited, prefer placement changes over heavy EQ.'
      : strategy === 'fit' && item.frequency < 400
        ? 'Fit mode favours filling bass/mid dips — adjust gain to taste.'
        : 'Boost only with caution. If the effect is small, disable the band.',
  };
}

export function createSuggestions(
  curve: CurvePoint[],
  maxBands = 8,
  strategy: EqStrategyId = 'balanced',
): Suggestion[] {
  if (!curve.length) return [];

  return selectCandidates(curve, strategy, maxBands)
    .sort((a, b) => a.frequency - b.frequency)
    .map((item) => candidateToSuggestion(item, strategy));
}

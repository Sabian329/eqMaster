import type { CurvePoint, Suggestion } from '../types';
import { buildCorrectedCurve } from './correctedCurve';

/** Match-range weight — Pro focuses on body/modes (40–850 Hz). */
export function refinedMatchRangeWeight(frequency: number): number {
  if (frequency < 35 || frequency > 18000) return 0;
  if (frequency <= 850) return 2.4;
  if (frequency <= 1200) return 0.5;
  if (frequency <= 2500) return 0.18;
  return 0.06;
}

function clampQ(q: number): number {
  return Math.max(0.4, Math.min(12, q));
}

function clampGain(gain: number, kind: 'cut' | 'boost'): number {
  if (kind === 'cut') return Math.max(-13, Math.min(-0.2, gain));
  return Math.max(0.2, Math.min(12, gain));
}

function localShoulderDb(curve: CurvePoint[], index: number, radius: number): number {
  let shoulder = curve[index].db;
  for (let j = index - radius; j <= index + radius; j++) {
    if (j < 0 || j >= curve.length || j === index) continue;
    shoulder = Math.max(shoulder, curve[j].db);
  }
  return shoulder;
}

/**
 * Estimate raw Q from curve shape.
 * Cuts: −3 dB width (sharp peaks). Boosts: ~55% depth (biased wide).
 */
export function estimateFilterQ(
  curve: CurvePoint[],
  index: number,
  kind: 'cut' | 'boost',
): number {
  const center = curve[index];
  const centerDb = center.db;

  let threshold: number;
  if (kind === 'cut') {
    threshold = centerDb - 3;
  } else {
    const shoulder = localShoulderDb(curve, index, 5);
    const depth = Math.max(0.8, shoulder - centerDb);
    threshold = centerDb + Math.max(1.5, depth * 0.55);
  }

  let left = index;
  let right = index;

  if (kind === 'cut') {
    while (left > 0 && curve[left].db > threshold) left--;
    while (right < curve.length - 1 && curve[right].db > threshold) right++;
  } else {
    while (left > 0 && curve[left].db < threshold) left--;
    while (right < curve.length - 1 && curve[right].db < threshold) right++;
  }

  const width = curve[right].frequency - curve[left].frequency;
  if (width <= 0) return kind === 'cut' ? 4 : 1;

  return clampQ(center.frequency / width);
}

/**
 * Pro rule: cuts = narrow candle (high Q), boosts = wide hill (low Q).
 */
export function shapeRefinedFilterQ(
  measuredQ: number,
  frequency: number,
  kind: 'cut' | 'boost',
  _gainDb: number,
  deviation: number,
): number {
  const magnitude = Math.abs(deviation);

  if (kind === 'cut') {
    let q = Math.max(measuredQ, 4.2);
    if (magnitude >= 7) q = Math.max(q, 5.5);
    if (magnitude >= 10) q = Math.max(q, 6.5);
    if (frequency > 800) q = Math.max(q, 3.8);
    return clampQ(q);
  }

  let q = Math.min(measuredQ * 0.5, 1.55);
  if (frequency < 150) q = Math.min(q, 0.95);
  else if (frequency < 350) q = Math.min(q, 1.15);
  else if (frequency < 800) q = Math.min(q, 1.35);
  else q = Math.min(q, 1.55);

  return clampQ(Math.max(0.55, q));
}

/** Partial cut — narrow filter, don't over-correct neighbouring bass. */
export function computeRefinedCutGain(
  deviation: number,
  frequency: number,
  q: number,
): number {
  const magnitude = Math.max(0, deviation);
  if (magnitude < 0.4) return 0;

  let ratio = 0.78;
  if (q >= 6) ratio = 0.86;
  else if (q >= 4.5) ratio = 0.82;

  if (frequency < 180) ratio *= 0.68;
  else if (frequency < 350) ratio *= 0.82;

  return clampGain(-magnitude * ratio, 'cut');
}

/** Wide boost — fill dips smoothly toward the reference line. */
export function computeRefinedBoostGain(
  deviation: number,
  frequency: number,
  _q: number,
): number {
  const depth = Math.abs(Math.min(0, deviation));
  if (depth < 0.35) return 0;

  let ratio = 0.74;
  if (frequency < 200) ratio = 0.7;
  else if (frequency < 500) ratio = 0.76;
  else if (frequency > 2000) ratio = 0.62;

  return clampGain(depth * ratio, 'boost');
}

export function refinedCandidateScore(
  kind: 'cut' | 'boost',
  deviation: number,
  frequency: number,
  q: number,
): number {
  const magnitude = Math.abs(deviation);
  let score = magnitude * refinedMatchRangeWeight(frequency);

  if (kind === 'boost') {
    if (frequency < 500) score *= 1.5;
    if (frequency < 200) score *= 1.2;
  } else {
    if (frequency < 250) score *= 0.35;
    if (q >= 5) score *= 1.15;
    if (q < 4) score *= 0.45;
  }

  return score;
}

/** Only cut obvious narrow peaks — ignore broad bass humps. */
export function refinedPeakThreshold(frequency: number, scale = 1): number {
  if (frequency <= 200) return Math.max(4.5, 5.5 * scale);
  if (frequency <= 850) return Math.max(2.2, 2.8 * scale);
  if (frequency <= 1500) return Math.max(3.5, 4.2 * scale);
  return Math.max(5, 6 * scale);
}

export function refinedDipThreshold(frequency: number, scale = 1): number {
  if (frequency <= 850) return Math.min(-0.9, -1.1 * scale);
  if (frequency <= 1500) return Math.min(-1.5, -2 * scale);
  return Math.min(-2.5, -3.2 * scale);
}

/** Avoid stacking filters too close — reduces bass kill from overlapping cuts. */
export function refinedMinSpacing(frequency: number, passSpacing: number): number {
  if (frequency < 200) return Math.max(passSpacing, 1.18);
  if (frequency < 500) return Math.max(passSpacing, 1.16);
  if (frequency < 900) return Math.max(passSpacing, 1.14);
  return passSpacing;
}

function localFlatnessError(
  corrected: CurvePoint[],
  centerHz: number,
  halfOctaves: number,
): number {
  const fLow = centerHz / 2 ** halfOctaves;
  const fHigh = centerHz * 2 ** halfOctaves;
  let sumSq = 0;
  let count = 0;

  for (const point of corrected) {
    if (point.frequency < fLow || point.frequency > fHigh) continue;
    sumSq += point.db * point.db;
    count++;
  }

  return count ? sumSq / count : Number.POSITIVE_INFINITY;
}

function optimizeOneFilterGain(
  measuredCurve: CurvePoint[],
  suggestions: Suggestion[],
  targetIndex: number,
): Suggestion {
  const target = suggestions[targetIndex];
  if (target.gain === null || target.kind === 'null') return target;

  const kind = target.kind as 'cut' | 'boost';
  const halfOctaves = kind === 'cut' ? 0.28 : 0.75;
  const deviation = target.deviation ?? 0;
  const magnitude = Math.abs(deviation);

  const start =
    kind === 'cut' ? Math.max(-13, -magnitude * 1.05) : Math.min(12, magnitude * 1.05);
  const end = kind === 'cut' ? -0.2 : 0.2;
  const step = 0.25;

  let bestGain = target.gain;
  let bestError = Number.POSITIVE_INFINITY;

  const steps: number[] = [];
  if (kind === 'cut') {
    for (let g = start; g <= end; g += step) steps.push(g);
  } else {
    for (let g = end; g <= start; g += step) steps.push(g);
  }

  for (const trialGain of steps) {
    const trial = { ...target, gain: trialGain };
    const trialSet = suggestions.map((item, index) =>
      index === targetIndex ? trial : item,
    );
    const corrected = buildCorrectedCurve(measuredCurve, trialSet, 0);
    const error = localFlatnessError(corrected, target.frequency, halfOctaves);

    if (error < bestError) {
      bestError = error;
      bestGain = trialGain;
    }
  }

  return { ...target, gain: clampGain(bestGain, kind) };
}

/**
 * Iteratively tune each filter gain so the predicted curve hugs 0 dB locally.
 * Q stays fixed (narrow cut / wide boost decided earlier).
 */
export function optimizeRefinedSuggestions(
  measuredCurve: CurvePoint[],
  suggestions: Suggestion[],
): Suggestion[] {
  if (!measuredCurve.length || !suggestions.length) return suggestions;

  let current = suggestions.map((item) => ({ ...item }));

  for (let pass = 0; pass < 2; pass++) {
    for (let index = 0; index < current.length; index++) {
      current[index] = optimizeOneFilterGain(measuredCurve, current, index);
    }
  }

  return current;
}

/** Rough headroom hint when large boosts are stacked. */
export function suggestHeadroomPreampDb(
  suggestions: Array<{ enabled?: boolean; gain: number | null }>,
): number | null {
  let positiveSum = 0;
  for (const item of suggestions) {
    if (item.enabled === false) continue;
    if (item.gain !== null && item.gain > 0) positiveSum += item.gain;
  }
  if (positiveSum < 1.2) return null;
  return -Math.min(12, Math.max(0.5, positiveSum * 0.32));
}

/** Skip cuts that aren't narrow enough — prevents bass wipeout. */
export function shouldSkipRefinedPeakCut(
  frequency: number,
  deviation: number,
  q: number,
): boolean {
  if (q < 3.8) return true;
  if (frequency < 280 && deviation < 5.5) return true;
  if (frequency < 180 && q < 5) return true;
  return false;
}

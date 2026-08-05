import type { CurvePoint, Suggestion } from '../types';

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

export function createSuggestions(curve: CurvePoint[], maxBands = 8): Suggestion[] {
  const candidates: Array<{
    index: number;
    frequency: number;
    deviation: number;
    kind: 'cut' | 'boost' | 'null';
    score: number;
    q: number;
  }> = [];
  const radius = 5;

  for (let i = radius; i < curve.length - radius; i++) {
    const point = curve[i];
    if (point.frequency < 25 || point.frequency > 18000) continue;

    let localMax = true;
    let localMin = true;

    for (let j = i - radius; j <= i + radius; j++) {
      if (j === i) continue;
      if (curve[j].db > point.db) localMax = false;
      if (curve[j].db < point.db) localMin = false;
    }

    if (localMax && point.db >= 3) {
      candidates.push({
        index: i,
        frequency: point.frequency,
        deviation: point.db,
        kind: 'cut',
        score: point.db,
        q: estimateQ(curve, i, point.db),
      });
    }

    if (localMin && point.db <= -4) {
      candidates.push({
        index: i,
        frequency: point.frequency,
        deviation: point.db,
        kind: 'boost',
        score: Math.abs(point.db) * 0.75,
        q: estimateQ(curve, i, point.db),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const selected: typeof candidates = [];

  for (const candidate of candidates) {
    const tooClose = selected.some((item) => {
      const ratio =
        Math.max(item.frequency, candidate.frequency) /
        Math.min(item.frequency, candidate.frequency);
      return ratio < 1.22;
    });

    if (!tooClose) selected.push(candidate);
    if (selected.length >= maxBands) break;
  }

  return selected
    .sort((a, b) => a.frequency - b.frequency)
    .map((item) => {
      if (item.kind === 'cut') {
        const gain = -Math.min(10, Math.max(1, item.deviation - 1));
        return {
          kind: 'cut' as const,
          frequency: item.frequency,
          deviation: item.deviation,
          gain,
          q: item.q,
          note: 'Try a cut first. Set filter width based on the chart and run a verification measurement.',
        };
      }

      if (item.kind === 'null') {
        return {
          kind: 'null' as const,
          frequency: item.frequency,
          deviation: item.deviation,
          gain: null,
          q: item.q,
          note: 'Likely room cancellation. Enable only with caution and verify with a second measurement.',
        };
      }

      const deepDip = item.deviation <= -8;
      const gain = deepDip
        ? Math.min(2, Math.max(0.5, Math.abs(item.deviation) - 5))
        : Math.min(3, Math.max(1, Math.abs(item.deviation) - 2));
      return {
        kind: 'boost' as const,
        frequency: item.frequency,
        deviation: item.deviation,
        gain,
        q: item.q,
        note: deepDip
          ? 'Deep dip — start with a small boost. If headroom is limited, prefer placement changes over heavy EQ.'
          : 'Boost only with caution. If the effect is small, disable the band.',
      };
    });
}

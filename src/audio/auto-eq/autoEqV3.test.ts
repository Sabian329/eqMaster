import { describe, expect, it } from 'vitest';
import { generateAutoEqV3 } from './v3/autoEqV3';
import { getMinimumImprovementPercent } from './v3/initialSelection';
import { getFilterResponseDb } from './v3/biquadResponse';
import { buildTargetCurve } from './v3/target';
import { detectResonanceCandidates } from './v3/resonanceCandidates';
import { detectTonalCandidates } from './v3/tonalCandidates';
import { prepareMeasurement } from './v3/prepareMeasurement';
import { DEFAULT_V3_OPTIONS } from './v3/constants';
import { runAutoEqPipelineV3 } from '../../utils/autoEqBridgeV3';

const SAMPLE_RATE = 48_000;

function peakingShape(f: number, center: number, gainDb: number, q: number): number {
  return getFilterResponseDb(
    { type: 'PK', frequency: center, gainDb, q },
    f,
    SAMPLE_RATE,
  );
}

function buildStressMeasurement() {
  const grid = Array.from({ length: 240 }, (_, index) => ({
    frequency: 20 * 2 ** (index / 12),
    db: 0,
  }));

  for (const point of grid) {
    point.db += peakingShape(point.frequency, 130, 6, 6);
    point.db += peakingShape(point.frequency, 220, 5, 5);
    point.db += peakingShape(point.frequency, 320, 4.5, 4);
    point.db += peakingShape(point.frequency, 800, -10, 14);
    if (point.frequency >= 2_000 && point.frequency <= 8_000) point.db += 3.5;
    if (point.frequency >= 1_500 && point.frequency <= 2_500) point.db += 2;
  }

  return grid;
}

describe('auto-eq V3', () => {
  it('uses adaptive minimum improvement thresholds', () => {
    expect(getMinimumImprovementPercent(0)).toBe(0.04);
    expect(getMinimumImprovementPercent(4)).toBe(0.08);
    expect(getMinimumImprovementPercent(8)).toBe(0.15);
    expect(getMinimumImprovementPercent(12)).toBe(0.25);
  });

  it('separates resonance and tonal candidate pools', () => {
    const measurement = buildStressMeasurement();
    const prepared = prepareMeasurement([measurement], DEFAULT_V3_OPTIONS);
    const resonances = detectResonanceCandidates(prepared);
    const tonal = detectTonalCandidates(prepared);

    expect(resonances.length).toBeGreaterThan(0);
    expect(tonal.length).toBeGreaterThan(0);
    expect(resonances.some((item) => item.frequency < 400)).toBe(true);
    expect(tonal.some((item) => item.frequency > 1_000)).toBe(true);
  });

  it('uses the same target for cost and chart output', () => {
    const measurement = buildStressMeasurement();
    const result = generateAutoEqV3([measurement], {
      ...DEFAULT_V3_OPTIONS,
      targetType: 'room',
      sampleRate: SAMPLE_RATE,
    });

    expect(result.targetType).toBe('room');
    expect(result.target.length).toBeGreaterThan(10);
    expect(result.target).toEqual(
      prepareMeasurement([measurement], { ...DEFAULT_V3_OPTIONS, targetType: 'room' }).target,
    );
  });

  it('produces more than two filters on a multi-problem synthetic curve', () => {
    const result = generateAutoEqV3([buildStressMeasurement()], {
      ...DEFAULT_V3_OPTIONS,
      sampleRate: SAMPLE_RATE,
      seed: 42,
    });

    expect(result.filters.length).toBeGreaterThan(2);
    expect(result.filters.length).toBeLessThanOrEqual(16);
    expect(result.weightedRmsAfterDb).toBeLessThan(result.weightedRmsBeforeDb);
    expect(result.stopReason).toBeTruthy();
  });

  it('is deterministic for identical input and seed', () => {
    const measurement = [buildStressMeasurement()];
    const first = generateAutoEqV3(measurement, { ...DEFAULT_V3_OPTIONS, seed: 42 });
    const second = generateAutoEqV3(measurement, { ...DEFAULT_V3_OPTIONS, seed: 42 });

    expect(first.filters.map((f) => [f.frequency, f.gainDb, f.q, f.type])).toEqual(
      second.filters.map((f) => [f.frequency, f.gainDb, f.q, f.type]),
    );
  }, 20_000);

  it('maps to suggestions through the V3 bridge', () => {
    const pipeline = runAutoEqPipelineV3(buildStressMeasurement(), {
      sampleRate: SAMPLE_RATE,
      targetType: 'room',
    });

    expect(pipeline.suggestions.length).toBe(pipeline.v3?.filters.length);
    expect(pipeline.v3?.targetType).toBe('room');
  });

  it('builds flat target consistently', () => {
    const grid = buildStressMeasurement();
    const flat = buildTargetCurve(grid, { ...DEFAULT_V3_OPTIONS, targetType: 'flat' });
    expect(flat.every((point) => point.db === 0)).toBe(true);
  });

  it('rejects cancelling filter stacks on synthetic opposite candidates', () => {
    const measurement = buildStressMeasurement();
    const result = generateAutoEqV3([measurement], {
      ...DEFAULT_V3_OPTIONS,
      sampleRate: SAMPLE_RATE,
      seed: 7,
    });

    for (let left = 0; left < result.filters.length; left += 1) {
      for (let right = left + 1; right < result.filters.length; right += 1) {
        const a = result.filters[left];
        const b = result.filters[right];
        const distance = Math.abs(Math.log2(a.frequency / b.frequency));
        const opposite = Math.sign(a.gainDb) !== Math.sign(b.gainDb);
        if (distance < 1 / 8 && opposite) {
          expect(Math.abs(a.gainDb)).toBeLessThan(4.5);
        }
      }
    }
  });
});

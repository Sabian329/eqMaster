import { describe, expect, it } from 'vitest';
import { generateAutoEqV2 } from './autoEq';
import { getFilterResponseDb } from './biquad';
import { clampFilterGain, getFrequencyLimits } from './frequencyLimits';
import { huber, interpolateLogarithmically, qFromBandwidthOctaves, SeededRandom } from './math';
import { calculatePreampDb } from './preamp';
import { smoothFractionalOctave } from './smoothing';
import { alignTargetToMeasurement, buildTargetCurve } from './target';
import { sanitizeMeasurement } from './measurement';
import { runAutoEqPipelineV2 } from '../../utils/autoEqBridgeV2';
import type { GeneratedEqFilter } from './types';

const SAMPLE_RATE = 48_000;

function peakingShape(
  frequency: number,
  center: number,
  gainDb: number,
  q: number,
): number {
  return getFilterResponseDb(
    { type: 'PK', frequency: center, gainDb, q },
    frequency,
    SAMPLE_RATE,
  );
}

function buildSyntheticMeasurements(): Array<Array<{ frequency: number; db: number }>> {
  const grid = Array.from({ length: 240 }, (_, index) => {
    const frequency = 20 * 2 ** (index / 12);
    return { frequency, db: 0 };
  });

  const base = grid.map((point) => ({ ...point }));

  const applyPeakingToBase = (center: number, gainDb: number, q: number) => {
    for (const point of base) {
      point.db += peakingShape(point.frequency, center, gainDb, q);
    }
  };

  applyPeakingToBase(48, 9, 8);
  applyPeakingToBase(72, 7, 5);
  applyPeakingToBase(140, 5, 3);
  applyPeakingToBase(190, -14, 12);
  applyPeakingToBase(2_700, 4, 4);

  const measurementA = base.map((point) => ({ ...point }));
  const measurementB = base.map((point) => ({ ...point }));
  const measurementC = base.map((point) => ({ ...point }));

  for (const point of measurementA) {
    if (point.frequency >= 8_000 && point.frequency <= 20_000) {
      point.db += 2.5;
    }
    if (Math.abs(point.frequency - 7_000) < 40) {
      point.db += 5;
    }
  }

  for (const point of measurementB) {
    if (point.frequency >= 8_000 && point.frequency <= 20_000) {
      point.db += 2.5;
    }
  }

  for (const point of measurementC) {
    if (point.frequency >= 8_000 && point.frequency <= 20_000) {
      point.db += 2.5;
    }
  }

  return [measurementA, measurementB, measurementC];
}

describe('auto-eq V2 math utilities', () => {
  it('interpolates logarithmically between points', () => {
    const points = [
      { frequency: 100, db: 0 },
      { frequency: 1_000, db: 10 },
    ];
    expect(interpolateLogarithmically(points, 316)).toBeCloseTo(5, 0);
  });

  it('smooths on a log-frequency scale', () => {
    const points = [
      { frequency: 100, db: 0 },
      { frequency: 200, db: 10 },
      { frequency: 400, db: 0 },
    ];
    const smoothed = smoothFractionalOctave(points, 3);
    expect(smoothed[1].db).toBeGreaterThan(0);
    expect(smoothed[1].db).toBeLessThanOrEqual(10);
  });

  it('builds and aligns room target curve', () => {
    const grid = [
      { frequency: 100, db: 2 },
      { frequency: 500, db: 1 },
      { frequency: 1_000, db: 0 },
    ];
    const target = buildTargetCurve(grid, {
      targetType: 'room',
      maxFilters: 16,
      allowBoosts: true,
      fullRangeCorrection: true,
      minFrequency: 20,
      maxFrequency: 20_000,
      sampleRate: SAMPLE_RATE,
      seed: 42,
      precision: 'standard',
    });
    const aligned = alignTargetToMeasurement(grid, target);
    expect(Math.abs(aligned[2].db - grid[2].db)).toBeLessThan(1.5);
  });

  it('computes Q from bandwidth octaves', () => {
    expect(qFromBandwidthOctaves(1 / 3)).toBeGreaterThan(2);
  });

  it('uses huber loss for large errors', () => {
    expect(huber(10)).toBeLessThan(50);
    expect(huber(1)).toBeCloseTo(0.5, 1);
  });

  it('applies frequency-dependent limits', () => {
    const limits = getFrequencyLimits(12_000);
    expect(clampFilterGain(5, 12_000)).toBeLessThanOrEqual(limits.maxBoostDb);
    expect(clampFilterGain(-10, 12_000)).toBeGreaterThanOrEqual(limits.maxCutDb);
  });
});

describe('auto-eq V2 biquad responses', () => {
  it('returns about +6 dB for a +6 dB peaking filter at center', () => {
    const response = getFilterResponseDb(
      { type: 'PK', frequency: 1_000, gainDb: 6, q: 1.4 },
      1_000,
      SAMPLE_RATE,
    );
    expect(response).toBeCloseTo(6, 0.2);
  });

  it('returns about -6 dB for a -6 dB peaking filter at center', () => {
    const response = getFilterResponseDb(
      { type: 'PK', frequency: 500, gainDb: -6, q: 1.4 },
      500,
      SAMPLE_RATE,
    );
    expect(response).toBeCloseTo(-6, 0.2);
  });

  it('approaches 0 dB far from center frequency', () => {
    const response = getFilterResponseDb(
      { type: 'PK', frequency: 1_000, gainDb: 6, q: 1.4 },
      10_000,
      SAMPLE_RATE,
    );
    expect(Math.abs(response)).toBeLessThan(0.5);
  });
});

describe('auto-eq V2 integration', () => {
  it('reduces error on a synthetic multi-measurement room curve', () => {
    const measurements = buildSyntheticMeasurements();
    const result = generateAutoEqV2(measurements, {
      sampleRate: SAMPLE_RATE,
      maxFilters: 16,
      targetType: 'flat',
      seed: 42,
      precision: 'standard',
    });

    expect(result.filters.length).toBeGreaterThan(0);
    expect(result.filters.length).toBeLessThanOrEqual(16);
    expect(result.errorAfter).toBeLessThan(result.errorBefore);
    expect(result.rmsErrorAfterDb).toBeLessThan(result.rmsErrorBeforeDb);
    expect(result.preampDb).toBeLessThanOrEqual(-0.8);

    const lowCut = result.filters.find(
      (filter: GeneratedEqFilter) => filter.frequency < 200 && filter.gainDb < 0,
    );
    expect(lowCut).toBeTruthy();

    const nullBoost = result.filters.find(
      (filter: GeneratedEqFilter) =>
        filter.frequency >= 170 && filter.frequency <= 210 && filter.gainDb > 0,
    );
    expect(nullBoost).toBeFalsy();

    for (const filter of result.filters) {
      const limits = getFrequencyLimits(filter.frequency, filter.type);
      if (filter.gainDb < 0) {
        expect(filter.gainDb).toBeGreaterThanOrEqual(limits.maxCutDb - 0.01);
      } else {
        expect(filter.gainDb).toBeLessThanOrEqual(limits.maxBoostDb + 0.01);
      }
    }
  });

  it('is deterministic for identical input and seed', () => {
    const measurements = buildSyntheticMeasurements().slice(0, 1);
    const first = generateAutoEqV2(measurements, { seed: 42, sampleRate: SAMPLE_RATE });
    const second = generateAutoEqV2(measurements, { seed: 42, sampleRate: SAMPLE_RATE });

    expect(first.filters.map((filter: GeneratedEqFilter) => [filter.frequency, filter.gainDb, filter.q])).toEqual(
      second.filters.map((filter: GeneratedEqFilter) => [filter.frequency, filter.gainDb, filter.q]),
    );
  });

  it('calculates preamp with at least 0.8 dB headroom', () => {
    const filters = [
      {
        id: '1',
        type: 'PK' as const,
        frequency: 100,
        gainDb: 3,
        q: 1,
        enabled: true,
        confidence: 1,
        improvementPercent: 1,
        affectedRange: { fromHz: 50, toHz: 200 },
        reason: 'modal-resonance' as const,
      },
    ];
    const { preampDb } = calculatePreampDb(filters, {
      targetType: 'room',
      maxFilters: 16,
      allowBoosts: true,
      fullRangeCorrection: true,
      minFrequency: 20,
      maxFrequency: 20_000,
      sampleRate: SAMPLE_RATE,
      seed: 42,
      precision: 'standard',
    });
    expect(preampDb).toBeCloseTo(-3.8, 0);
  });

  it('maps V2 pipeline output to suggestions', () => {
    const measurements = buildSyntheticMeasurements().slice(0, 1);
    const pipeline = runAutoEqPipelineV2(measurements[0], {
      sampleRate: SAMPLE_RATE,
      measurements,
    });

    expect(pipeline.suggestions.length).toBeGreaterThan(0);
    expect(pipeline.suggestions.every((item) => item.source === 'auto')).toBe(true);
  });

  it('sanitizes invalid measurement points', () => {
    const cleaned = sanitizeMeasurement([
      { frequency: -1, db: 0 },
      { frequency: 100, db: Number.NaN },
      ...Array.from({ length: 12 }, (_, index) => ({
        frequency: 100 + index * 10,
        db: index,
      })),
    ]);
    expect(cleaned.length).toBeGreaterThanOrEqual(10);
  });

  it('uses seeded random deterministically', () => {
    const first = new SeededRandom(42);
    const second = new SeededRandom(42);
    expect(first.next()).toBe(second.next());
  });
});

import { describe, expect, it } from 'vitest';
import { generateAutoEqV2 } from './autoEq';
import { getFilterResponseDb } from './biquad';
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

function buildRegressionMeasurements(): Array<Array<{ frequency: number; db: number }>> {
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

  const measurement = base.map((point) => ({ ...point }));
  for (const point of measurement) {
    if (point.frequency >= 8_000 && point.frequency <= 20_000) {
      point.db += 2.5;
    }
  }

  return [measurement];
}

/** Frozen V2 baseline — do not update unless V2 intentionally changes. */
const V2_REGRESSION_BASELINE = {
  filterCount: 2,
  preampDb: -0.8,
  errorAfter: 1.273_400,
  filters: [
    { type: 'HS', frequency: 2_393.8, gainDb: -3.55, q: 0.5 },
    { type: 'PK', frequency: 71.7, gainDb: -4.71, q: 4.29 },
  ] as const,
};

describe('auto-eq V2 regression', () => {
  it('keeps identical results after V3 implementation', () => {
    const result = generateAutoEqV2(buildRegressionMeasurements(), {
      sampleRate: SAMPLE_RATE,
      maxFilters: 16,
      targetType: 'room',
      seed: 42,
      precision: 'standard',
    });

    expect(result.filters.length).toBe(V2_REGRESSION_BASELINE.filterCount);
    expect(result.preampDb).toBeCloseTo(V2_REGRESSION_BASELINE.preampDb, 1);
    expect(result.errorAfter).toBeCloseTo(V2_REGRESSION_BASELINE.errorAfter, 3);

    const summary = result.filters.map((filter: GeneratedEqFilter) => ({
      type: filter.type,
      frequency: Math.round(filter.frequency * 10) / 10,
      gainDb: Math.round(filter.gainDb * 100) / 100,
      q: Math.round(filter.q * 100) / 100,
    }));

    for (let index = 0; index < V2_REGRESSION_BASELINE.filters.length; index += 1) {
      const expected = V2_REGRESSION_BASELINE.filters[index];
      const actual = summary[index];
      expect(actual.type).toBe(expected.type);
      expect(actual.frequency).toBeCloseTo(expected.frequency, 0);
      expect(actual.gainDb).toBeCloseTo(expected.gainDb, 0.5);
      expect(actual.q).toBeCloseTo(expected.q, 0.5);
    }
  });
});

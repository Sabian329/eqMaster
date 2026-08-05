import { describe, expect, it } from 'vitest';
import {
  generateAutoEq,
  getPeakingResponseDb,
  type FrequencyPoint,
  type PeakingEqFilter,
} from '../audio/autoEq';
import { createMockMeasurementRun } from '../utils/mockMeasurement';

function buildLogGrid(
  fMin: number,
  fMax: number,
  count: number,
): FrequencyPoint[] {
  const minLog = Math.log2(fMin);
  const maxLog = Math.log2(fMax);

  return Array.from({ length: count }, (_, index) => {
    const ratio = index / (count - 1);
    const frequency = 2 ** (minLog + ratio * (maxLog - minLog));
    return { frequency, db: 0 };
  });
}

function addGaussianPeak(
  points: FrequencyPoint[],
  centerHz: number,
  gainDb: number,
  widthOctaves: number,
): void {
  for (const point of points) {
    const distance = Math.log2(point.frequency / centerHz);
    point.db += gainDb * Math.exp(-0.5 * (distance / widthOctaves) ** 2);
  }
}

function buildSyntheticRoomCurve(): FrequencyPoint[] {
  const points = buildLogGrid(20, 8_000, 240);
  addGaussianPeak(points, 63, 8, 0.07);
  addGaussianPeak(points, 120, 5, 0.14);
  addGaussianPeak(points, 180, -12, 0.035);
  return points;
}

describe('generateAutoEq', () => {
  it('handles synthetic resonance + narrow null per spec', () => {
    const measurement = buildSyntheticRoomCurve();

    const result = generateAutoEq(measurement, {
      sampleRate: 48_000,
      minFrequency: 20,
      maxAnalysisFrequency: 8_000,
      maxCorrectionFrequency: 1_000,
      maxFilters: 10,
      target: 'flat',
      smoothingFraction: 12,
    });

    expect(result.filters.length).toBeGreaterThan(0);
    expect(result.filters.length).toBeLessThanOrEqual(10);
    expect(result.errorAfter).toBeLessThan(result.errorBefore);

    for (const filter of result.filters) {
      expect(filter.gainDb).toBeGreaterThanOrEqual(-12);
      expect(filter.gainDb).toBeLessThanOrEqual(3);
      expect(filter.q).toBeGreaterThanOrEqual(0.5);
      expect(filter.q).toBeLessThanOrEqual(12);
      if (filter.gainDb > 0) {
        expect(filter.q).toBeLessThanOrEqual(2.5);
      }
    }

    const cutsNear63 = result.filters.filter(
      (filter) => filter.gainDb < 0 && filter.frequency >= 45 && filter.frequency <= 85,
    );
    const cutsNear120 = result.filters.filter(
      (filter) => filter.gainDb < 0 && filter.frequency >= 90 && filter.frequency <= 160,
    );

    expect(cutsNear63.length).toBeGreaterThan(0);
    expect(cutsNear120.length).toBeGreaterThan(0);

    const boostsNear180 = result.filters.filter(
      (filter) =>
        filter.gainDb > 0 &&
        filter.frequency >= 150 &&
        filter.frequency <= 210,
    );
    const totalNullBoost = boostsNear180.reduce(
      (sum, filter) => sum + filter.gainDb,
      0,
    );
    expect(totalNullBoost).toBeLessThanOrEqual(3.5);

    expect(result.preampDb).toBeLessThanOrEqual(0);
    expect(result.corrected.length).toBe(result.measured.length);
    expect(result.target.length).toBe(result.measured.length);
  });

  it('uses more of the filter budget when maxFilters is higher', () => {
    const { curve } = createMockMeasurementRun({
      fMin: 40,
      fMax: 20_000,
      smoothing: 6,
      durationSeconds: 1,
      levelDb: -12,
      channel: 'both',
      runIndex: 3,
    });

    const smallBudget = generateAutoEq(curve, {
      sampleRate: 48_000,
      minFrequency: 40,
      maxAnalysisFrequency: 20_000,
      maxCorrectionFrequency: 2_450,
      maxFilters: 5,
      target: 'flat',
      smoothingFraction: 12,
    });

    const largeBudget = generateAutoEq(curve, {
      sampleRate: 48_000,
      minFrequency: 40,
      maxAnalysisFrequency: 20_000,
      maxCorrectionFrequency: 2_450,
      maxFilters: 12,
      target: 'flat',
      smoothingFraction: 12,
    });

    expect(largeBudget.filters.length).toBeGreaterThan(smallBudget.filters.length);
    expect(largeBudget.errorAfter).toBeLessThanOrEqual(smallBudget.errorAfter + 0.05);
  });

  it('uses RBJ peaking response with unity at center frequency', () => {
    const filter: PeakingEqFilter = {
      type: 'PK',
      frequency: 500,
      gainDb: 4,
      q: 2,
    };

    const atCenter = getPeakingResponseDb(filter, 500, 48_000);
    expect(atCenter).toBeCloseTo(4, 0.5);
  });
});

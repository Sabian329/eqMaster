import { clamp } from './math';
import type { EqFilterType, GeneratedEqFilter } from './types';

export interface BiquadCoefficients {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

export interface FilterParams {
  type: EqFilterType;
  frequency: number;
  gainDb: number;
  q: number;
}

const normalizeCoefficients = (
  b0: number,
  b1: number,
  b2: number,
  a0: number,
  a1: number,
  a2: number,
): BiquadCoefficients => ({
  b0: b0 / a0,
  b1: b1 / a0,
  b2: b2 / a0,
  a1: a1 / a0,
  a2: a2 / a0,
});

export const createFilterCoefficients = (
  filter: FilterParams,
  sampleRate: number,
): BiquadCoefficients => {
  const safeFrequency = clamp(filter.frequency, 1, sampleRate * 0.49);
  const omega = (2 * Math.PI * safeFrequency) / sampleRate;
  const sinOmega = Math.sin(omega);
  const cosOmega = Math.cos(omega);
  const alpha = sinOmega / (2 * Math.max(filter.q, 0.1));
  const a = 10 ** (filter.gainDb / 40);

  if (filter.type === 'PK') {
    const b0 = 1 + alpha * a;
    const b1 = -2 * cosOmega;
    const b2 = 1 - alpha * a;
    const a0 = 1 + alpha / a;
    const a1 = -2 * cosOmega;
    const a2 = 1 - alpha / a;
    return normalizeCoefficients(b0, b1, b2, a0, a1, a2);
  }

  if (filter.type === 'LS') {
    const sqrtA = Math.sqrt(a);
    const b0 = a * ((a + 1) - (a - 1) * cosOmega + 2 * sqrtA * alpha);
    const b1 = 2 * a * ((a - 1) - (a + 1) * cosOmega);
    const b2 = a * ((a + 1) - (a - 1) * cosOmega - 2 * sqrtA * alpha);
    const a0 = (a + 1) + (a - 1) * cosOmega + 2 * sqrtA * alpha;
    const a1 = -2 * ((a - 1) + (a + 1) * cosOmega);
    const a2 = (a + 1) + (a - 1) * cosOmega - 2 * sqrtA * alpha;
    return normalizeCoefficients(b0, b1, b2, a0, a1, a2);
  }

  const sqrtA = Math.sqrt(a);
  const b0 = a * ((a + 1) + (a - 1) * cosOmega + 2 * sqrtA * alpha);
  const b1 = -2 * a * ((a - 1) + (a + 1) * cosOmega);
  const b2 = a * ((a + 1) + (a - 1) * cosOmega - 2 * sqrtA * alpha);
  const a0 = (a + 1) - (a - 1) * cosOmega + 2 * sqrtA * alpha;
  const a1 = 2 * ((a - 1) - (a + 1) * cosOmega);
  const a2 = (a + 1) - (a - 1) * cosOmega - 2 * sqrtA * alpha;
  return normalizeCoefficients(b0, b1, b2, a0, a1, a2);
};

export const getFilterResponseDb = (
  filter: FilterParams,
  frequency: number,
  sampleRate: number,
): number => {
  const coefficients = createFilterCoefficients(filter, sampleRate);
  const omega = (2 * Math.PI * frequency) / sampleRate;
  const cos1 = Math.cos(omega);
  const sin1 = Math.sin(omega);
  const cos2 = Math.cos(2 * omega);
  const sin2 = Math.sin(2 * omega);

  const numeratorReal =
    coefficients.b0 + coefficients.b1 * cos1 + coefficients.b2 * cos2;
  const numeratorImaginary =
    -coefficients.b1 * sin1 - coefficients.b2 * sin2;
  const denominatorReal =
    1 + coefficients.a1 * cos1 + coefficients.a2 * cos2;
  const denominatorImaginary =
    -coefficients.a1 * sin1 - coefficients.a2 * sin2;

  const numeratorPower =
    numeratorReal * numeratorReal + numeratorImaginary * numeratorImaginary;
  const denominatorPower =
    denominatorReal * denominatorReal + denominatorImaginary * denominatorImaginary;

  const safeRatio = Math.max(
    numeratorPower / Math.max(denominatorPower, 1e-20),
    1e-20,
  );

  return 10 * Math.log10(safeRatio);
};

export const getCombinedFilterResponseDb = (
  filters: GeneratedEqFilter[],
  frequency: number,
  sampleRate: number,
): number => {
  let total = 0;
  for (const filter of filters) {
    if (!filter.enabled || Math.abs(filter.gainDb) < 0.01) continue;
    total += getFilterResponseDb(filter, frequency, sampleRate);
  }
  return total;
};

export const toFilterParams = (filter: GeneratedEqFilter): FilterParams => ({
  type: filter.type,
  frequency: filter.frequency,
  gainDb: filter.gainDb,
  q: filter.q,
});

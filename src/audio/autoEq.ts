export interface FrequencyPoint {
  frequency: number;
  db: number;
}

export interface PeakingEqFilter {
  type: 'PK';
  frequency: number;
  gainDb: number;
  q: number;
}

export interface AutoEqOptions {
  sampleRate?: number;

  minFrequency?: number;
  maxAnalysisFrequency?: number;
  maxCorrectionFrequency?: number;

  gridSize?: number;
  smoothingFraction?: number;

  maxFilters?: number;
  maxCutDb?: number;
  maxBoostDb?: number;

  minQ?: number;
  maxQ?: number;
  maxBoostQ?: number;

  toleranceDb?: number;
  headroomDb?: number;

  target?: 'flat' | 'house';
  targetPoints?: FrequencyPoint[];
}

export interface AutoEqResult {
  filters: PeakingEqFilter[];
  preampDb: number;

  measured: FrequencyPoint[];
  target: FrequencyPoint[];
  corrected: FrequencyPoint[];

  errorBefore: number;
  errorAfter: number;
}

interface RequiredOptions {
  sampleRate: number;

  minFrequency: number;
  maxAnalysisFrequency: number;
  maxCorrectionFrequency: number;

  gridSize: number;
  smoothingFraction: number;

  maxFilters: number;
  maxCutDb: number;
  maxBoostDb: number;

  minQ: number;
  maxQ: number;
  maxBoostQ: number;

  toleranceDb: number;
  headroomDb: number;

  target: 'flat' | 'house';
  targetPoints?: FrequencyPoint[];
}

export const DEFAULT_AUTO_EQ_OPTIONS: RequiredOptions = {
  sampleRate: 48_000,

  minFrequency: 20,
  maxAnalysisFrequency: 20_000,
  maxCorrectionFrequency: 1_000,

  gridSize: 512,
  smoothingFraction: 12,

  maxFilters: 10,
  maxCutDb: -12,
  maxBoostDb: 3,

  minQ: 0.5,
  maxQ: 12,
  maxBoostQ: 2.5,

  toleranceDb: 1.5,
  headroomDb: 0.5,

  target: 'house',
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const dbToGain = (db: number): number => 10 ** (db / 20);

const round = (value: number, digits: number): number => {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
};

const median = (values: number[]): number => {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
};

export const sanitizeMeasurement = (points: FrequencyPoint[]): FrequencyPoint[] => {
  const valid = points
    .filter(
      (point) =>
        Number.isFinite(point.frequency) &&
        Number.isFinite(point.db) &&
        point.frequency > 0,
    )
    .sort((a, b) => a.frequency - b.frequency);

  const deduplicated: FrequencyPoint[] = [];

  for (const point of valid) {
    const previous = deduplicated.at(-1);

    if (previous && previous.frequency === point.frequency) {
      previous.db = (previous.db + point.db) / 2;
    } else {
      deduplicated.push({ ...point });
    }
  }

  if (deduplicated.length < 10) {
    throw new Error(
      'Too few valid measurement points. At least 10 are required.',
    );
  }

  return deduplicated;
};

export const interpolateLogarithmically = (
  points: FrequencyPoint[],
  frequency: number,
): number => {
  if (frequency <= points[0].frequency) return points[0].db;

  const last = points[points.length - 1];
  if (frequency >= last.frequency) return last.db;

  let low = 0;
  let high = points.length - 1;

  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle].frequency <= frequency) low = middle;
    else high = middle;
  }

  const left = points[low];
  const right = points[high];
  const logFrequency = Math.log2(frequency);
  const logLeft = Math.log2(left.frequency);
  const logRight = Math.log2(right.frequency);
  const ratio = (logFrequency - logLeft) / (logRight - logLeft);

  return left.db + ratio * (right.db - left.db);
};

const createLogarithmicGrid = (
  points: FrequencyPoint[],
  minFrequency: number,
  maxFrequency: number,
  count: number,
): FrequencyPoint[] => {
  const minLog = Math.log2(minFrequency);
  const maxLog = Math.log2(maxFrequency);

  return Array.from({ length: count }, (_, index) => {
    const ratio = index / (count - 1);
    const frequency = 2 ** (minLog + ratio * (maxLog - minLog));

    return {
      frequency,
      db: interpolateLogarithmically(points, frequency),
    };
  });
};

export const smoothFractionalOctave = (
  points: FrequencyPoint[],
  fraction: number,
): FrequencyPoint[] => {
  if (fraction <= 0) return points.map((point) => ({ ...point }));

  const sigmaOctaves = 1 / fraction / 2.355;
  const maximumDistance = sigmaOctaves * 3;

  return points.map((point) => {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const candidate of points) {
      const distance = Math.log2(candidate.frequency / point.frequency);
      if (Math.abs(distance) > maximumDistance) continue;

      const weight = Math.exp(-0.5 * (distance / sigmaOctaves) ** 2);
      weightedSum += candidate.db * weight;
      totalWeight += weight;
    }

    return {
      frequency: point.frequency,
      db: totalWeight > 0 ? weightedSum / totalWeight : point.db,
    };
  });
};

export const HOUSE_TARGET: FrequencyPoint[] = [
  { frequency: 20, db: 3 },
  { frequency: 50, db: 2.5 },
  { frequency: 100, db: 2 },
  { frequency: 300, db: 1 },
  { frequency: 1_000, db: 0 },
  { frequency: 5_000, db: -0.5 },
  { frequency: 10_000, db: -1 },
  { frequency: 20_000, db: -2 },
];

const createTargetCurve = (
  frequencies: FrequencyPoint[],
  options: RequiredOptions,
): FrequencyPoint[] => {
  let targetPoints: FrequencyPoint[];

  if (options.targetPoints && options.targetPoints.length >= 2) {
    targetPoints = sanitizeMeasurement(options.targetPoints);
  } else if (options.target === 'house') {
    targetPoints = HOUSE_TARGET;
  } else {
    targetPoints = [
      { frequency: options.minFrequency, db: 0 },
      { frequency: options.maxAnalysisFrequency, db: 0 },
    ];
  }

  return frequencies.map((point) => ({
    frequency: point.frequency,
    db: interpolateLogarithmically(targetPoints, point.frequency),
  }));
};

const normalizeMeasurement = (
  measured: FrequencyPoint[],
  target: FrequencyPoint[],
  options: RequiredOptions,
): FrequencyPoint[] => {
  const referenceErrors = measured
    .map((point, index) => ({
      frequency: point.frequency,
      difference: point.db - target[index].db,
    }))
    .filter(
      (point) =>
        point.frequency >= 200 &&
        point.frequency <= Math.min(1_000, options.maxCorrectionFrequency),
    )
    .map((point) => point.difference);

  const fallbackErrors = measured.map(
    (point, index) => point.db - target[index].db,
  );

  const levelOffset = median(
    referenceErrors.length > 0 ? referenceErrors : fallbackErrors,
  );

  return measured.map((point) => ({
    frequency: point.frequency,
    db: point.db - levelOffset,
  }));
};

interface BiquadCoefficients {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

export const createPeakingCoefficients = (
  filter: PeakingEqFilter,
  sampleRate: number,
): BiquadCoefficients => {
  const safeFrequency = clamp(filter.frequency, 1, sampleRate * 0.49);
  const a = 10 ** (filter.gainDb / 40);
  const omega = (2 * Math.PI * safeFrequency) / sampleRate;
  const alpha = Math.sin(omega) / (2 * filter.q);
  const cosine = Math.cos(omega);

  const b0 = 1 + alpha * a;
  const b1 = -2 * cosine;
  const b2 = 1 - alpha * a;
  const a0 = 1 + alpha / a;
  const a1 = -2 * cosine;
  const a2 = 1 - alpha / a;

  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  };
};

export const getPeakingResponseDb = (
  filter: PeakingEqFilter,
  frequency: number,
  sampleRate: number,
): number => {
  const coefficients = createPeakingCoefficients(filter, sampleRate);
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
    denominatorReal * denominatorReal +
    denominatorImaginary * denominatorImaginary;

  const safeRatio = Math.max(
    numeratorPower / Math.max(denominatorPower, 1e-20),
    1e-20,
  );

  return 10 * Math.log10(safeRatio);
};

const createFilterResponse = (
  filter: PeakingEqFilter,
  points: FrequencyPoint[],
  sampleRate: number,
): number[] =>
  points.map((point) => getPeakingResponseDb(filter, point.frequency, sampleRate));

const huberLoss = (error: number, delta = 2.5): number => {
  const absolute = Math.abs(error);
  if (absolute <= delta) return 0.5 * error * error;
  return delta * (absolute - 0.5 * delta);
};

const getFrequencyWeight = (frequency: number): number => {
  if (frequency < 80) return 1.15;
  if (frequency < 500) return 1.4;
  if (frequency < 1_000) return 1.15;
  return 0.6;
};

export const calculateAutoEqCost = (
  measured: FrequencyPoint[],
  target: FrequencyPoint[],
  eqResponse: number[],
  filters: PeakingEqFilter[],
  options: RequiredOptions,
): number => {
  let totalLoss = 0;
  let totalWeight = 0;

  for (let index = 0; index < measured.length; index += 1) {
    const frequency = measured[index].frequency;
    if (frequency > options.maxCorrectionFrequency) continue;

    const predictedDb = measured[index].db + eqResponse[index];
    const rawError = target[index].db - predictedDb;
    const limitedError = clamp(rawError, -12, 12);
    const weight = getFrequencyWeight(frequency);

    totalLoss += huberLoss(limitedError) * weight;
    totalWeight += weight;
  }

  let cost = totalLoss / Math.max(totalWeight, 1);

  const filterPenaltyScale =
    filters.length / Math.max(options.maxFilters, 1);

  for (const filter of filters) {
    if (filter.gainDb > 0) {
      cost += 0.075 * filter.gainDb * filter.gainDb;
    }
    if (filter.q > 6) {
      cost += 0.008 * (filter.q - 6) ** 2;
    }
    cost += 0.005 * filterPenaltyScale;
  }

  return cost;
};

const qFromBandwidthOctaves = (bandwidthOctaves: number): number => {
  const safeBandwidth = Math.max(bandwidthOctaves, 1 / 48);
  const ratio = 2 ** safeBandwidth;
  return Math.sqrt(ratio) / Math.max(ratio - 1, 1e-6);
};

interface ErrorPeak {
  index: number;
  frequency: number;
  errorDb: number;
  q: number;
  bandwidthOctaves: number;
  score: number;
}

interface FindErrorPeaksOptions {
  toleranceDb?: number;
  relaxed?: boolean;
}

const findErrorPeaks = (
  measured: FrequencyPoint[],
  target: FrequencyPoint[],
  eqResponse: number[],
  options: RequiredOptions,
  peakOptions: FindErrorPeaksOptions = {},
): ErrorPeak[] => {
  const toleranceDb = peakOptions.toleranceDb ?? options.toleranceDb;
  const relaxed = peakOptions.relaxed ?? false;
  const errors = measured.map(
    (point, index) => target[index].db - (point.db + eqResponse[index]),
  );

  const peaks: ErrorPeak[] = [];

  for (let index = 1; index < errors.length - 1; index += 1) {
    const frequency = measured[index].frequency;

    if (
      frequency < options.minFrequency ||
      frequency > options.maxCorrectionFrequency
    ) {
      continue;
    }

    const error = errors[index];
    const absoluteError = Math.abs(error);

    if (absoluteError < toleranceDb) continue;

    const neighborMax = Math.max(
      Math.abs(errors[index - 1]),
      Math.abs(errors[index + 1]),
    );

    if (relaxed) {
      if (absoluteError < neighborMax * 0.82) continue;
    } else if (absoluteError < neighborMax) {
      continue;
    }

    const sign = Math.sign(error);
    const halfHeight = absoluteError * 0.5;

    let left = index;
    let right = index;

    while (
      left > 0 &&
      Math.sign(errors[left - 1]) === sign &&
      Math.abs(errors[left - 1]) >= halfHeight
    ) {
      left -= 1;
    }

    while (
      right < errors.length - 1 &&
      Math.sign(errors[right + 1]) === sign &&
      Math.abs(errors[right + 1]) >= halfHeight
    ) {
      right += 1;
    }

    const lowFrequency = measured[left].frequency;
    const highFrequency = measured[right].frequency;
    const bandwidthOctaves = Math.max(
      Math.log2(highFrequency / lowFrequency),
      1 / 48,
    );

    let q = clamp(
      qFromBandwidthOctaves(bandwidthOctaves),
      options.minQ,
      options.maxQ,
    );

    if (frequency > 1_000) q = Math.min(q, 2.5);

    const isBoost = error > 0;

    if (isBoost && bandwidthOctaves < 0.35) continue;
    if (isBoost && q > options.maxBoostQ) continue;

    const score =
      absoluteError *
      Math.max(bandwidthOctaves, 0.08) *
      (isBoost ? 0.65 : 1.2);

    peaks.push({
      index,
      frequency,
      errorDb: error,
      q,
      bandwidthOctaves,
      score,
    });
  }

  const peakLimit = options.maxFilters >= 10 ? 24 : 16;
  return peaks.sort((a, b) => b.score - a.score).slice(0, peakLimit);
};

/** Residual scan — used when local-extrema search finds nothing but budget remains. */
const findTopErrorPoints = (
  measured: FrequencyPoint[],
  target: FrequencyPoint[],
  eqResponse: number[],
  options: RequiredOptions,
  minErrorDb: number,
): ErrorPeak[] => {
  const errors = measured.map(
    (point, index) => target[index].db - (point.db + eqResponse[index]),
  );

  const peaks: ErrorPeak[] = [];

  for (let index = 0; index < errors.length; index += 1) {
    const frequency = measured[index].frequency;

    if (
      frequency < options.minFrequency ||
      frequency > options.maxCorrectionFrequency
    ) {
      continue;
    }

    const error = errors[index];
    const absoluteError = Math.abs(error);
    if (absoluteError < minErrorDb) continue;

    const isBoost = error > 0;
    let q = isBoost ? 1.4 : clamp(4 + absoluteError * 0.25, 2, options.maxQ);

    if (isBoost && q > options.maxBoostQ) q = options.maxBoostQ;

    peaks.push({
      index,
      frequency,
      errorDb: error,
      q,
      bandwidthOctaves: 0.18,
      score: absoluteError * (isBoost ? 0.7 : 1.15),
    });
  }

  return peaks.sort((a, b) => b.score - a.score).slice(0, 24);
};

const filtersAreTooSimilar = (
  existing: PeakingEqFilter[],
  candidate: PeakingEqFilter,
  minOctaveSeparation = 1 / 24,
): boolean =>
  existing.some((filter) => {
    const distanceOctaves = Math.abs(
      Math.log2(filter.frequency / candidate.frequency),
    );
    const sameDirection = Math.sign(filter.gainDb) === Math.sign(candidate.gainDb);
    return sameDirection && distanceOctaves < minOctaveSeparation;
  });

interface FilterSearchContext {
  measured: FrequencyPoint[];
  target: FrequencyPoint[];
  eqResponse: number[];
  filters: PeakingEqFilter[];
  options: RequiredOptions;
  availableMin: number;
  availableMax: number;
  currentCost: number;
  minOctaveSeparation: number;
}

interface FilterSearchResult {
  filter: PeakingEqFilter | null;
  response: number[] | null;
  cost: number;
}

const selectBestFilterForPeaks = (
  peaks: ErrorPeak[],
  context: FilterSearchContext,
): FilterSearchResult => {
  let bestFilter: PeakingEqFilter | null = null;
  let bestResponse: number[] | null = null;
  let bestCost = context.currentCost;

  for (const peak of peaks) {
    const baseGain = clamp(
      peak.errorDb * 0.85,
      context.options.maxCutDb,
      context.options.maxBoostDb,
    );

    const frequencyMultipliers = [0.96, 0.98, 1, 1.02, 1.04];
    const qMultipliers = [0.65, 0.8, 1, 1.25, 1.55];
    const gainMultipliers = [0.6, 0.8, 1];

    for (const frequencyMultiplier of frequencyMultipliers) {
      for (const qMultiplier of qMultipliers) {
        for (const gainMultiplier of gainMultipliers) {
          const frequency = clamp(
            peak.frequency * frequencyMultiplier,
            context.availableMin,
            Math.min(context.options.maxCorrectionFrequency, context.availableMax),
          );

          let q = clamp(peak.q * qMultiplier, context.options.minQ, context.options.maxQ);
          let gainDb = clamp(
            baseGain * gainMultiplier,
            context.options.maxCutDb,
            context.options.maxBoostDb,
          );

          if (frequency > 1_000) {
            q = Math.min(q, 2.5);
            gainDb = clamp(gainDb, -3, 2);
          }

          if (gainDb > 0 && q > context.options.maxBoostQ) continue;

          const candidate: PeakingEqFilter = {
            type: 'PK',
            frequency,
            gainDb,
            q,
          };

          if (
            filtersAreTooSimilar(
              context.filters,
              candidate,
              context.minOctaveSeparation,
            )
          ) {
            continue;
          }

          const candidateResponse = createFilterResponse(
            candidate,
            context.measured,
            context.options.sampleRate,
          );
          const combinedResponse = context.eqResponse.map(
            (value, index) => value + candidateResponse[index],
          );
          const candidateCost = calculateAutoEqCost(
            context.measured,
            context.target,
            combinedResponse,
            [...context.filters, candidate],
            context.options,
          );

          if (candidateCost < bestCost) {
            bestCost = candidateCost;
            bestFilter = candidate;
            bestResponse = combinedResponse;
          }
        }
      }
    }
  }

  return { filter: bestFilter, response: bestResponse, cost: bestCost };
};

const collectPeaksForIteration = (
  measured: FrequencyPoint[],
  target: FrequencyPoint[],
  eqResponse: number[],
  options: RequiredOptions,
  fillPressure: number,
): ErrorPeak[] => {
  const effectiveTolerance =
    options.toleranceDb * (0.3 + 0.7 * (1 - fillPressure));

  let peaks = findErrorPeaks(measured, target, eqResponse, options, {
    toleranceDb: effectiveTolerance,
  });

  if (peaks.length === 0) {
    peaks = findErrorPeaks(measured, target, eqResponse, options, {
      toleranceDb: effectiveTolerance * 0.5,
      relaxed: true,
    });
  }

  if (peaks.length === 0 && fillPressure > 0.15) {
    peaks = findTopErrorPoints(
      measured,
      target,
      eqResponse,
      options,
      Math.max(0.35, effectiveTolerance * 0.45),
    );
  }

  return peaks;
};

export const generateAutoEq = (
  rawMeasurement: FrequencyPoint[],
  userOptions: AutoEqOptions = {},
): AutoEqResult => {
  const options: RequiredOptions = {
    ...DEFAULT_AUTO_EQ_OPTIONS,
    ...userOptions,
  };

  if (
    options.maxCutDb >= 0 ||
    options.maxBoostDb < 0 ||
    options.minQ <= 0 ||
    options.maxQ < options.minQ
  ) {
    throw new Error('Invalid Auto EQ generator settings.');
  }

  const sanitized = sanitizeMeasurement(rawMeasurement);

  const availableMin = Math.max(options.minFrequency, sanitized[0].frequency);
  const availableMax = Math.min(
    options.maxAnalysisFrequency,
    sanitized[sanitized.length - 1].frequency,
    options.sampleRate * 0.49,
  );

  if (availableMax <= availableMin) {
    throw new Error('Invalid measurement frequency range.');
  }

  const grid = createLogarithmicGrid(
    sanitized,
    availableMin,
    availableMax,
    options.gridSize,
  );
  const smoothed = smoothFractionalOctave(grid, options.smoothingFraction);
  const target = createTargetCurve(smoothed, options);
  const measured = normalizeMeasurement(smoothed, target, options);

  let eqResponse = Array.from<number>({ length: measured.length }).fill(0);
  const filters: PeakingEqFilter[] = [];

  let currentCost = calculateAutoEqCost(
    measured,
    target,
    eqResponse,
    filters,
    options,
  );
  const errorBefore = currentCost;

  const tryAddFilter = (
    fillPressure: number,
    minimumImprovementRatio: number,
    minOctaveSeparation: number,
  ): boolean => {
    const peaks = collectPeaksForIteration(
      measured,
      target,
      eqResponse,
      options,
      fillPressure,
    );
    if (peaks.length === 0) return false;

    const searchResult = selectBestFilterForPeaks(peaks, {
      measured,
      target,
      eqResponse,
      filters,
      options,
      availableMin,
      availableMax,
      currentCost,
      minOctaveSeparation,
    });

    if (!searchResult.filter || !searchResult.response) return false;

    const improvement = currentCost - searchResult.cost;
    const minimumImprovement = Math.max(
      0.0008,
      currentCost * minimumImprovementRatio,
    );
    if (improvement < minimumImprovement) return false;

    filters.push(searchResult.filter);
    eqResponse = searchResult.response;
    currentCost = searchResult.cost;
    return true;
  };

  for (let filterIndex = 0; filterIndex < options.maxFilters; filterIndex += 1) {
    const fillPressure =
      (options.maxFilters - filterIndex) / Math.max(options.maxFilters, 1);
    const minimumImprovementRatio =
      0.01 * Math.max(0.04, 1 - fillPressure * 0.96);
    const minOctaveSeparation =
      fillPressure > 0.35 ? 1 / 36 : 1 / 24;

    if (!tryAddFilter(fillPressure, minimumImprovementRatio, minOctaveSeparation)) {
      break;
    }
  }

  while (filters.length < options.maxFilters) {
    const fillPressure =
      (options.maxFilters - filters.length) / Math.max(options.maxFilters, 1);
    if (fillPressure < 0.08) break;

    const added = tryAddFilter(fillPressure, 0.0004, 1 / 48);
    if (!added) break;
  }

  const roundedFilters = filters.map((filter) => ({
    type: 'PK' as const,
    frequency: Math.round(filter.frequency),
    gainDb: round(filter.gainDb, 2),
    q: round(filter.q, 2),
  }));

  const finalEqResponse = Array.from<number>({ length: measured.length }).fill(0);
  for (const filter of roundedFilters) {
    const response = createFilterResponse(filter, measured, options.sampleRate);
    for (let index = 0; index < finalEqResponse.length; index += 1) {
      finalEqResponse[index] += response[index];
    }
  }

  const maximumBoost = Math.max(0, ...finalEqResponse);
  const preampDb = round(-(maximumBoost + options.headroomDb), 2);

  const corrected = measured.map((point, index) => ({
    frequency: point.frequency,
    db: point.db + finalEqResponse[index],
  }));

  const errorAfter = calculateAutoEqCost(
    measured,
    target,
    finalEqResponse,
    roundedFilters,
    options,
  );

  return {
    filters: roundedFilters,
    preampDb,
    measured,
    target,
    corrected,
    errorBefore: round(errorBefore, 4),
    errorAfter: round(errorAfter, 4),
  };
};

export const preampDbToLinearGain = (preampDb: number): number =>
  dbToGain(preampDb);

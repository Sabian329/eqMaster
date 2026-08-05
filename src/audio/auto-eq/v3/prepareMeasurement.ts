import {
  BELOW_TARGET_BOOST_LIMIT_DB,
  BROAD_SMOOTHING_FRACTION,
  DETAILED_SMOOTHING_FRACTION,
  MEASUREMENT_GRID_SIZE,
  SIM_GRID_SIZE,
  USABLE_RANGE_DROP_DB,
} from './constants';
import {
  clamp,
  createLogarithmicGrid,
  interpolateLogarithmically,
  median,
  medianAbsoluteDeviation,
} from './math';
import { smoothFractionalOctave } from './smoothing';
import { getCombinedFilterResponseDb } from './biquadResponse';
import { alignTargetToMeasurement, buildTargetCurve } from './target';
import type {
  AutoEqV3Options,
  AutoEqV3Warning,
  FrequencyPoint,
  GeneratedEqFilter,
  PreparedMeasurement,
} from './types';

const MIN_POINTS = 10;

export function sanitizeMeasurement(points: FrequencyPoint[]): FrequencyPoint[] {
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
    if (previous && Math.abs(previous.frequency - point.frequency) < 1e-6) {
      previous.db = (previous.db + point.db) / 2;
    } else {
      deduplicated.push({ ...point });
    }
  }

  if (deduplicated.length < MIN_POINTS) {
    throw new Error('Too few valid measurement points. At least 10 are required.');
  }

  return deduplicated;
}

export function sanitizeMeasurements(measurements: FrequencyPoint[][]): FrequencyPoint[][] {
  return measurements.map((points) => sanitizeMeasurement(points));
}

function computeReliability(repeatabilityDb: number): number {
  return Math.exp(-((repeatabilityDb / 1.5) ** 2));
}

export function singleMeasurementReliability(
  frequency: number,
  measurementCount: number,
): number {
  if (measurementCount > 1) return 1;
  if (frequency < 500) return 1;
  if (frequency < 2_000) return 0.85;
  if (frequency < 5_000) return 0.65;
  return 0.45;
}

function detectUsableBoostRange(
  broad: FrequencyPoint[],
  referenceDb: number,
): { fromHz: number; toHz: number } {
  let fromHz = broad[0]?.frequency ?? 20;
  let toHz = broad[broad.length - 1]?.frequency ?? 20_000;

  for (const point of broad) {
    if (point.db >= referenceDb - USABLE_RANGE_DROP_DB) {
      fromHz = point.frequency;
      break;
    }
  }

  for (let index = broad.length - 1; index >= 0; index -= 1) {
    const point = broad[index];
    if (point.db >= referenceDb - USABLE_RANGE_DROP_DB) {
      toHz = point.frequency;
      break;
    }
  }

  return { fromHz, toHz };
}

export function prepareMeasurement(
  measurements: FrequencyPoint[][],
  options: AutoEqV3Options,
): PreparedMeasurement {
  const sanitized = sanitizeMeasurements(measurements);
  const nyquist = options.sampleRate * 0.49;
  const maxFrequency = Math.min(options.maxFrequency, nyquist);

  const grid = createLogarithmicGrid(options.minFrequency, maxFrequency, MEASUREMENT_GRID_SIZE);
  const simGrid = createLogarithmicGrid(options.minFrequency, maxFrequency, SIM_GRID_SIZE);

  const alignedMeasurements = sanitized.map((points) =>
    grid.map((point) => ({
      frequency: point.frequency,
      db: interpolateLogarithmically(points, point.frequency),
    })),
  );

  const warnings: AutoEqV3Warning[] = [];
  const measurementCount = alignedMeasurements.length;

  const detailed = grid.map((point, index) => {
    const values = alignedMeasurements.map((measurement) => measurement[index].db);
    return { frequency: point.frequency, db: median(values) };
  });

  const repeatabilityDb = new Float64Array(grid.length);
  const reliability = new Float64Array(grid.length);

  for (let index = 0; index < grid.length; index += 1) {
    const values = alignedMeasurements.map((measurement) => measurement[index].db);
    repeatabilityDb[index] = medianAbsoluteDeviation(values);
    const baseReliability = computeReliability(repeatabilityDb[index]);
    const singleFactor = singleMeasurementReliability(grid[index].frequency, measurementCount);
    reliability[index] = baseReliability * singleFactor;
  }

  if (measurementCount === 1) {
    warnings.push('single-measurement-high-frequency-correction');
  }

  const lowRepeatabilityCount = Array.from(repeatabilityDb).filter((value) => value > 2.5).length;
  if (lowRepeatabilityCount > grid.length * 0.15) {
    warnings.push('low-repeatability');
  }

  const broad = smoothFractionalOctave(detailed, BROAD_SMOOTHING_FRACTION);
  const detailedSmoothed = smoothFractionalOctave(detailed, DETAILED_SMOOTHING_FRACTION);

  const rawTarget = buildTargetCurve(detailedSmoothed, options);
  const { aligned: target, levelOffsetDb } = alignTargetToMeasurement(detailedSmoothed, rawTarget);

  const narrowResidual = detailedSmoothed.map((point, index) => ({
    frequency: point.frequency,
    db: point.db - broad[index].db,
  }));

  const tonalError = broad.map((point, index) => ({
    frequency: point.frequency,
    db: point.db - target[index].db,
  }));

  const referenceValues = broad
    .filter((point) => point.frequency >= 200 && point.frequency <= 1_000)
    .map((point) => point.db);
  const referenceDb = median(referenceValues.length > 0 ? referenceValues : broad.map((point) => point.db));
  const usableBoostRange = detectUsableBoostRange(broad, referenceDb);

  if (usableBoostRange.toHz - usableBoostRange.fromHz < maxFrequency * 0.25) {
    warnings.push('correction-limited-by-speaker-range');
  }

  return {
    measured: detailedSmoothed.map((point) => ({ ...point })),
    detailed: detailedSmoothed,
    broad,
    target,
    narrowResidual,
    tonalError,
    reliability,
    repeatabilityDb,
    measurementCount,
    usableBoostRange,
    targetType: options.targetType,
    targetLevelOffsetDb: levelOffsetDb,
    simGrid,
    warnings,
  };
}

export function refreshPreparedResidual(
  prepared: PreparedMeasurement,
  filters: GeneratedEqFilter[],
  options: AutoEqV3Options,
): PreparedMeasurement {
  const corrected = prepared.measured.map((point) => ({
    frequency: point.frequency,
    db:
      point.db +
      getCombinedFilterResponseDb(filters, point.frequency, options.sampleRate),
  }));
  const broad = smoothFractionalOctave(corrected, BROAD_SMOOTHING_FRACTION);
  const detailed = smoothFractionalOctave(corrected, DETAILED_SMOOTHING_FRACTION);
  const narrowResidual = detailed.map((point, index) => ({
    frequency: point.frequency,
    db: point.db - broad[index].db,
  }));
  const tonalError = broad.map((point, index) => ({
    frequency: point.frequency,
    db: point.db - prepared.target[index].db,
  }));

  return {
    ...prepared,
    detailed,
    broad,
    narrowResidual,
    tonalError,
  };
}

export function isFrequencyInRange(
  frequency: number,
  range: { fromHz: number; toHz: number },
): boolean {
  return frequency >= range.fromHz && frequency <= range.toHz;
}

export function canBoostAtFrequency(
  prepared: PreparedMeasurement,
  frequency: number,
  options: AutoEqV3Options,
): boolean {
  if (!options.allowBoosts) return false;
  if (!isFrequencyInRange(frequency, prepared.usableBoostRange)) return false;

  const index = prepared.detailed.findIndex(
    (point) => Math.abs(Math.log2(point.frequency / frequency)) < 1 / 96,
  );
  if (index < 0) return true;

  const belowTarget =
    prepared.detailed[index].db <
      prepared.target[index].db - BELOW_TARGET_BOOST_LIMIT_DB ||
    prepared.broad[index].db < prepared.target[index].db - BELOW_TARGET_BOOST_LIMIT_DB;

  return !belowTarget;
}

export function clampFrequencyToOptions(frequency: number, options: AutoEqV3Options): number {
  return clamp(frequency, options.minFrequency, options.maxFrequency);
}

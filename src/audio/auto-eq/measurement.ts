import { clamp, createLogarithmicGrid, interpolateLogarithmically, median, medianAbsoluteDeviation } from './math';
import { BROAD_SMOOTHING_FRACTION, DETAILED_SMOOTHING_FRACTION, USABLE_RANGE_DROP_DB } from './constants';
import { getPrecisionSettings } from './precision';
import { smoothFractionalOctave } from './smoothing';
import { alignTargetToMeasurement, buildTargetCurve } from './target';
import type { AutoEqOptions, AutoEqWarning, FrequencyPoint, PreparedMeasurementGrid } from './types';

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

function detectUsableRange(
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

export function prepareMeasurementGrid(
  measurements: FrequencyPoint[][],
  options: AutoEqOptions,
): PreparedMeasurementGrid {
  const sanitized = sanitizeMeasurements(measurements);
  const nyquist = options.sampleRate * 0.49;
  const maxFrequency = Math.min(options.maxFrequency, nyquist);
  const gridSize = getPrecisionSettings(options.precision).measurementGridSize;

  const grid = createLogarithmicGrid(options.minFrequency, maxFrequency, gridSize);
  const alignedMeasurements = sanitized.map((points) =>
    grid.map((point) => ({
      frequency: point.frequency,
      db: interpolateLogarithmically(points, point.frequency),
    })),
  );

  const warnings: AutoEqWarning[] = [];
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
    reliability[index] = computeReliability(repeatabilityDb[index]);
  }

  if (measurementCount === 1) {
    warnings.push('single-measurement-high-frequency-correction');
    for (let index = 0; index < reliability.length; index += 1) {
      if (grid[index].frequency >= 5_000) {
        reliability[index] *= 0.55;
      }
    }
  }

  const lowRepeatabilityCount = Array.from(repeatabilityDb).filter((value) => value > 2.5).length;
  if (lowRepeatabilityCount > grid.length * 0.15) {
    warnings.push('low-repeatability');
  }

  const broad = smoothFractionalOctave(detailed, BROAD_SMOOTHING_FRACTION);
  const detailedSmoothed = smoothFractionalOctave(detailed, DETAILED_SMOOTHING_FRACTION);

  let target = buildTargetCurve(detailedSmoothed, options);
  target = alignTargetToMeasurement(detailedSmoothed, target);

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
  const usableRange = detectUsableRange(broad, referenceDb);

  if (usableRange.toHz - usableRange.fromHz < maxFrequency * 0.25) {
    warnings.push('correction-limited-by-speaker-range');
  }

  return {
    detailed: detailedSmoothed,
    broad,
    target,
    narrowResidual,
    tonalError,
    reliability,
    repeatabilityDb,
    measurementCount,
    usableRange,
    warnings,
  };
}

export function isFrequencyInRange(
  frequency: number,
  range: { fromHz: number; toHz: number },
): boolean {
  return frequency >= range.fromHz && frequency <= range.toHz;
}

export function canBoostAtFrequency(
  prepared: PreparedMeasurementGrid,
  frequency: number,
  options: AutoEqOptions,
): boolean {
  if (!options.allowBoosts) return false;
  if (!isFrequencyInRange(frequency, prepared.usableRange)) return false;

  const index = prepared.detailed.findIndex(
    (point) => Math.abs(Math.log2(point.frequency / frequency)) < 1 / 96,
  );
  if (index < 0) return true;

  const belowTarget =
    prepared.detailed[index].db <
    prepared.target[index].db - 10 ||
    prepared.broad[index].db < prepared.target[index].db - 10;

  return !belowTarget;
}

export function clampFrequencyToOptions(frequency: number, options: AutoEqOptions): number {
  return clamp(frequency, options.minFrequency, options.maxFrequency);
}

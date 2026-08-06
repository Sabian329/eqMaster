import { ROOM_TARGET } from './constants';
import { interpolateLogarithmically, median } from './math';
import type { AutoEqOptions, FrequencyPoint } from './types';

export const buildTargetPoints = (options: AutoEqOptions): FrequencyPoint[] => {
  if (options.targetType === 'custom' && options.customTarget && options.customTarget.length >= 2) {
    return [...options.customTarget].sort((a, b) => a.frequency - b.frequency);
  }
  if (options.targetType === 'flat') {
    return [
      { frequency: options.minFrequency, db: 0 },
      { frequency: options.maxFrequency, db: 0 },
    ];
  }
  return ROOM_TARGET;
};

export const buildTargetCurve = (
  frequencies: FrequencyPoint[],
  options: AutoEqOptions,
): FrequencyPoint[] => {
  const targetPoints = buildTargetPoints(options);
  return frequencies.map((point) => ({
    frequency: point.frequency,
    db: interpolateLogarithmically(targetPoints, point.frequency),
  }));
};

export const alignTargetToMeasurement = (
  measured: FrequencyPoint[],
  target: FrequencyPoint[],
): FrequencyPoint[] => {
  const referenceErrors = measured
    .map((point, index) => ({
      frequency: point.frequency,
      difference: point.db - target[index].db,
    }))
    .filter((point) => point.frequency >= 200 && point.frequency <= 1_000)
    .map((point) => point.difference);

  const fallbackErrors = measured.map((point, index) => point.db - target[index].db);
  const levelOffset = median(referenceErrors.length > 0 ? referenceErrors : fallbackErrors);

  return target.map((point) => ({
    frequency: point.frequency,
    db: point.db + levelOffset,
  }));
};

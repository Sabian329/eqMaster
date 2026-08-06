import {
  computeBeforeMetrics,
  computeCombinedFilterResponse,
  computeErrorMetrics,
  computePredictedCurve,
} from './costFunction';
import { interpolateLogarithmically } from './math';
import { prepareMeasurementGrid } from './measurement';
import { globalOptimization, greedyFilterSelection } from './optimizer';
import { postProcessFilters } from './postProcessing';
import { calculatePreampDb } from './preamp';
import { resolveAutoEqOptions } from './precision';
import type {
  AutoEqOptions,
  AutoEqProgress,
  AutoEqResultV2,
  AutoEqWarning,
  FrequencyPoint,
} from './types';

export type AutoEqProgressCallback = (progress: AutoEqProgress) => void;

export function generateAutoEqV2(
  measurements: FrequencyPoint[][],
  partialOptions: Partial<AutoEqOptions> = {},
  onProgress?: AutoEqProgressCallback,
): AutoEqResultV2 {
  if (measurements.length === 0) {
    throw new Error('At least one measurement is required.');
  }

  const options = resolveAutoEqOptions(partialOptions);

  onProgress?.({ stage: 'preparing', progress: 0.05 });

  const prepared = prepareMeasurementGrid(measurements, options);
  const warnings: AutoEqWarning[] = [...prepared.warnings];

  const alignedMeasurements = measurements.map((points) =>
    prepared.detailed.map((gridPoint) => ({
      frequency: gridPoint.frequency,
      db: interpolateLogarithmically(points, gridPoint.frequency),
    })),
  );

  onProgress?.({ stage: 'analyzing', progress: 0.12 });

  const beforeMetrics = computeBeforeMetrics(prepared, options);

  let filters = greedyFilterSelection(
    prepared,
    alignedMeasurements,
    options,
    onProgress,
  );

  filters = globalOptimization(
    filters,
    prepared,
    alignedMeasurements,
    options,
    onProgress,
  );

  onProgress?.({ stage: 'post-processing', progress: 0.82, filterCount: filters.length });

  filters = postProcessFilters(filters, prepared, alignedMeasurements, options);

  filters = globalOptimization(
    filters,
    prepared,
    alignedMeasurements,
    options,
    onProgress,
  );

  onProgress?.({ stage: 'finalizing', progress: 0.92, filterCount: filters.length });

  const { preampDb, warnings: preampWarnings } = calculatePreampDb(filters, options);
  warnings.push(...preampWarnings);

  const afterMetrics = computeErrorMetrics(prepared, filters, options);
  const predicted = computePredictedCurve(prepared, filters, options);
  const combinedFilterResponse = computeCombinedFilterResponse(
    filters,
    prepared.detailed,
    options.sampleRate,
  );

  const improvementPercent =
    ((beforeMetrics.scalarError - afterMetrics.scalarError) /
      Math.max(beforeMetrics.scalarError, 1e-6)) *
    100;

  const confidence = Math.max(
    0,
    Math.min(
      1,
      0.35 +
        (prepared.measurementCount > 1 ? 0.2 : 0) +
        Math.min(0.35, improvementPercent / 100) +
        Math.min(0.1, filters.length / options.maxFilters / 2),
    ),
  );

  if (afterMetrics.scalarError >= beforeMetrics.scalarError) {
    warnings.push('optimizer-stopped-early');
  }

  onProgress?.({
    stage: 'finalizing',
    progress: 1,
    filterCount: filters.length,
    currentCost: afterMetrics.scalarError,
  });

  return {
    filters,
    preampDb,
    measured: prepared.detailed,
    broadMeasured: prepared.broad,
    target: prepared.target,
    predicted,
    combinedFilterResponse,
    errorBefore: beforeMetrics.scalarError,
    errorAfter: afterMetrics.scalarError,
    rmsErrorBeforeDb: beforeMetrics.rmsErrorDb,
    rmsErrorAfterDb: afterMetrics.rmsErrorDb,
    maximumErrorBeforeDb: beforeMetrics.maximumErrorDb,
    maximumErrorAfterDb: afterMetrics.maximumErrorDb,
    confidence,
    warnings,
  };
}

export * from './types';
export * from './constants';
export * from './biquad';

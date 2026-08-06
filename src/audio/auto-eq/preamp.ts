import { HEADROOM_DB, PREAMP_WARNING_DB } from './constants';
import { getCombinedFilterResponseDb } from './biquad';
import { createLogarithmicGrid } from './math';
import { getPrecisionSettings } from './precision';
import type { AutoEqOptions, AutoEqWarning, GeneratedEqFilter } from './types';

export function calculatePreampDb(
  filters: GeneratedEqFilter[],
  options: AutoEqOptions,
): { preampDb: number; warnings: AutoEqWarning[] } {
  const warnings: AutoEqWarning[] = [];
  const gridSize = getPrecisionSettings(options.precision).preampGridSize;
  const grid = createLogarithmicGrid(options.minFrequency, options.maxFrequency, gridSize);

  let maximumCombinedBoostDb = 0;
  for (const point of grid) {
    const boost = getCombinedFilterResponseDb(filters, point.frequency, options.sampleRate);
    maximumCombinedBoostDb = Math.max(maximumCombinedBoostDb, boost);
  }

  const preampDb = -Math.max(0, maximumCombinedBoostDb) - HEADROOM_DB;

  if (preampDb < PREAMP_WARNING_DB) {
    warnings.push('excessive-required-headroom');
  }

  return { preampDb, warnings };
}

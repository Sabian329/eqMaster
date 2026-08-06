import type { CurvePoint, Suggestion } from '../types';
import type { AutoEqResult } from '../audio/autoEq';
import type { EqAlgorithmVersion } from '../config/eqAlgorithms';
import { runAutoEqPipeline, type AutoEqPipelineOptions } from './autoEqBridge';
import { runAutoEqPipelineV2, type AutoEqPipelineV2Options } from './autoEqBridgeV2';
import { runAutoEqPipelineV3, type AutoEqPipelineV3Options } from './autoEqBridgeV3';

export type CorrectionPipelineOptions = AutoEqPipelineOptions &
  AutoEqPipelineV2Options &
  AutoEqPipelineV3Options;

export function runCorrectionPipeline(
  version: EqAlgorithmVersion,
  rawCurve: CurvePoint[],
  options: CorrectionPipelineOptions = {},
): AutoEqResult & { suggestions: Suggestion[] } {
  switch (version) {
    case 'v3':
      return runAutoEqPipelineV3(rawCurve, {
        ...options,
        maxCorrectionFrequency: undefined,
        fullRangeCorrection: true,
      });
    case 'v2':
      return runAutoEqPipelineV2(rawCurve, {
        ...options,
        maxCorrectionFrequency: undefined,
        fullRangeCorrection: true,
      });
    case 'v1':
    default:
      return runAutoEqPipeline(rawCurve, options);
  }
}

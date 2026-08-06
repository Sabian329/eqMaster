import type { MeasurementRun } from './index';

export interface SavedMeasurement {
  id: string;
  /** Display name: label · frequency range · date · time */
  name: string;
  /** Optional user/context label (Room, Studio, custom, …). */
  label?: string;
  createdAt: string;
  fMin: number;
  fMax: number;
  smoothing: number;
  runs: MeasurementRun[];
  recorderMode: string;
}

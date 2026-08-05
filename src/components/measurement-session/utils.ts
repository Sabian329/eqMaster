import type { MeasurementSessionStep } from '../../types';
import { meterOptimalRangeLabel } from '../../utils/format';

export interface MeasurementSessionModalProps {
  state: import('../../hooks/useRoomEq').RoomEqState;
}

export function getSessionStepTitle(
  sessionStep: MeasurementSessionStep,
  isTestMode: boolean,
  nextRunNumber: number,
  sessionTargetCount: number,
  completedRuns: number,
): string {
  switch (sessionStep) {
    case 'mic-test':
      return 'Input level check';
    case 'ready':
      return isTestMode
        ? `Mock measurement ${nextRunNumber} of ${sessionTargetCount}`
        : `Measurement ${nextRunNumber} of ${sessionTargetCount}`;
    case 'measuring':
      return isTestMode
        ? `Generating mock ${nextRunNumber} of ${sessionTargetCount}`
        : `Running measurement ${nextRunNumber} of ${sessionTargetCount}`;
    case 'run-complete':
      return isTestMode
        ? `Mock ${completedRuns} complete`
        : `Measurement ${completedRuns} complete`;
    default:
      return '';
  }
}

export function getSessionStepDescription(
  sessionStep: MeasurementSessionStep,
  isTestMode: boolean,
  allRunsDone: boolean,
): string {
  switch (sessionStep) {
    case 'mic-test':
      return `Optional: play pink noise at the sweep digital level while monitoring the microphone. Adjust output volume and mic gain live — aim for the green zone (${meterOptimalRangeLabel()}), then continue.`;
    case 'ready':
      return isTestMode
        ? 'Start a mock run to preview the chart, EQ suggestions, and preset export.'
        : 'Keep the microphone still during each sweep. When you are ready, start the next measurement.';
    case 'measuring':
      return isTestMode
        ? 'Generating synthetic frequency response…'
        : 'Sweep in progress — do not move the microphone or change volume.';
    case 'run-complete':
      return allRunsDone
        ? 'All planned measurements are done. Finish the session to see individual runs and the averaged result.'
        : 'You can continue with the next measurement or finish now using the completed runs.';
    default:
      return '';
  }
}

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
  activeRunNumber?: number | null,
  isRedoRun?: boolean,
): string {
  const runNumber = activeRunNumber ?? nextRunNumber;

  switch (sessionStep) {
    case 'mic-test':
      return 'Input level check';
    case 'ready':
      return isTestMode
        ? `Mock measurement ${nextRunNumber} of ${sessionTargetCount}`
        : `Measurement ${nextRunNumber} of ${sessionTargetCount}`;
    case 'measuring':
      if (isRedoRun) {
        return isTestMode
          ? `Re-running mock ${runNumber} of ${sessionTargetCount}`
          : `Re-running measurement ${runNumber} of ${sessionTargetCount}`;
      }
      return isTestMode
        ? `Generating mock ${runNumber} of ${sessionTargetCount}`
        : `Running measurement ${runNumber} of ${sessionTargetCount}`;
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
        ? 'All planned measurements are done. Finish the session or redo any run to replace it.'
        : 'Continue with the next measurement, redo this run to replace it, or finish now.';
    default:
      return '';
  }
}

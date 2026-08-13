import type { MeasurementSessionStep } from '../../types';

export interface MeasurementSessionModalProps {
  state: import('../../hooks/useRoomEq').RoomEqState;
}

export function getSessionStepTitle(
  sessionStep: MeasurementSessionStep,
  nextRunNumber: number,
  sessionTargetCount: number,
  completedRuns: number,
  activeRunNumber?: number | null,
  isRedoRun?: boolean,
): string {
  const runNumber = activeRunNumber ?? nextRunNumber;

  switch (sessionStep) {
    case 'mic-test':
      return 'Input monitor';
    case 'ready':
      return `Measurement ${nextRunNumber} of ${sessionTargetCount}`;
    case 'measuring':
      if (isRedoRun) {
        return `Re-running measurement ${runNumber} of ${sessionTargetCount}`;
      }
      return `Running measurement ${runNumber} of ${sessionTargetCount}`;
    case 'run-complete':
      return `Measurement ${completedRuns} complete`;
    default:
      return '';
  }
}

export function getSessionStepDescription(
  sessionStep: MeasurementSessionStep,
  allRunsDone: boolean,
): string {
  switch (sessionStep) {
    case 'mic-test':
      return 'Optional: monitor the selected input with no playback, tap the microphone, then optionally play pink noise to set gain.';
    case 'ready':
      return 'Keep the microphone still during each sweep. When you are ready, start the next measurement.';
    case 'measuring':
      return 'Sweep in progress — do not move the microphone or change volume.';
    case 'run-complete':
      return allRunsDone
        ? 'All planned measurements are done. Finish the session or redo any run to replace it.'
        : 'Continue with the next measurement, redo this run to replace it, or finish now.';
    default:
      return '';
  }
}

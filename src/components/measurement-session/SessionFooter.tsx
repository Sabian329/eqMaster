import { Button } from '@chakra-ui/react';
import type { MeasurementSessionStep } from '../../types';
import type { RoomEqState } from '../../hooks/useRoomEq';
import { buttonStyles, modalStyles } from '../../theme';

interface SessionFooterProps {
  sessionStep: MeasurementSessionStep;
  running: boolean;
  canFinish: boolean;
  allRunsDone: boolean;
  nextRunNumber: number;
  lastCompletedRunNumber: number;
  onSkipMicTest: RoomEqState['handleSessionSkipMicTest'];
  onRunMeasurement: () => void;
  onStopMeasurement: RoomEqState['handleSessionStopMeasurement'];
  onRedoMeasurement: RoomEqState['handleSessionRedoMeasurement'];
  onContinue: RoomEqState['handleSessionContinue'];
  onFinish: (
    options?: string | { name?: string; prefix?: string },
  ) => void | Promise<void>;
  onCancel: RoomEqState['handleSessionCancel'];
}

export function SessionFooter({
  sessionStep,
  running,
  canFinish,
  allRunsDone,
  nextRunNumber,
  lastCompletedRunNumber,
  onSkipMicTest,
  onRunMeasurement,
  onStopMeasurement,
  onRedoMeasurement,
  onContinue,
  onFinish,
  onCancel,
}: SessionFooterProps) {
  return (
    <>
      {sessionStep === 'mic-test' && (
        <>
          <Button {...buttonStyles.secondary} {...modalStyles.actionButton} onClick={onSkipMicTest}>
            Skip
          </Button>
          <Button {...buttonStyles.primary} {...modalStyles.actionButton} onClick={onSkipMicTest}>
            Continue to measurement
          </Button>
        </>
      )}

      {sessionStep === 'ready' && (
        <>
          <Button
            {...buttonStyles.secondary}
            {...modalStyles.actionButton}
            disabled={!canFinish}
            onClick={() => void onFinish()}
          >
            Finish session
          </Button>
          <Button
            {...buttonStyles.primary}
            {...modalStyles.actionButton}
            disabled={running}
            onClick={() => void onRunMeasurement()}
          >
            {`Start measurement ${nextRunNumber}`}
          </Button>
        </>
      )}

      {sessionStep === 'run-complete' && (
        <>
          <Button
            {...buttonStyles.secondary}
            {...modalStyles.actionButton}
            disabled={!canFinish}
            onClick={() => void onFinish()}
          >
            Finish session
          </Button>
          <Button
            {...buttonStyles.secondary}
            {...modalStyles.actionButton}
            onClick={() => onRedoMeasurement(lastCompletedRunNumber)}
          >
            {`Redo measurement ${lastCompletedRunNumber}`}
          </Button>
          {!allRunsDone && (
            <Button
              {...buttonStyles.primary}
              {...modalStyles.actionButton}
              onClick={onContinue}
            >
              Next measurement
            </Button>
          )}
        </>
      )}

      {sessionStep === 'measuring' && (
        <Button
          {...buttonStyles.danger}
          {...modalStyles.actionButton}
          onClick={onStopMeasurement}
        >
          Stop measurement
        </Button>
      )}

      {sessionStep !== 'measuring' && (
        <Button {...modalStyles.cancelButton} onClick={() => void onCancel()}>
          Cancel
        </Button>
      )}
    </>
  );
}

import { Button } from '@chakra-ui/react';
import type { MeasurementSessionStep } from '../../types';
import type { RoomEqState } from '../../hooks/useRoomEq';
import { buttonStyles } from '../../theme';

interface SessionFooterProps {
  sessionStep: MeasurementSessionStep;
  running: boolean;
  canFinish: boolean;
  allRunsDone: boolean;
  nextRunNumber: number;
  isTestMode: boolean;
  onSkipMicTest: RoomEqState['handleSessionSkipMicTest'];
  onRunMeasurement: RoomEqState['handleSessionRunMeasurement'];
  onContinue: RoomEqState['handleSessionContinue'];
  onFinish: RoomEqState['handleSessionFinish'];
  onCancel: RoomEqState['handleSessionCancel'];
}

export function SessionFooter({
  sessionStep,
  running,
  canFinish,
  allRunsDone,
  nextRunNumber,
  isTestMode,
  onSkipMicTest,
  onRunMeasurement,
  onContinue,
  onFinish,
  onCancel,
}: SessionFooterProps) {
  return (
    <>
      {sessionStep === 'mic-test' && (
        <>
          <Button borderRadius="lg" {...buttonStyles.secondary} onClick={onSkipMicTest}>
            Skip
          </Button>
          <Button borderRadius="lg" {...buttonStyles.primary} onClick={onSkipMicTest}>
            Continue to measurement
          </Button>
        </>
      )}

      {sessionStep === 'ready' && (
        <>
          <Button
            borderRadius="lg"
            {...buttonStyles.secondary}
            disabled={!canFinish}
            onClick={() => void onFinish()}
          >
            Finish session
          </Button>
          <Button
            borderRadius="lg"
            {...buttonStyles.primary}
            disabled={running}
            onClick={() =>
              onRunMeasurement().catch((error) =>
                alert(error instanceof Error ? error.message : String(error)),
              )
            }
          >
            {isTestMode
              ? `Start mock ${nextRunNumber}`
              : `Start measurement ${nextRunNumber}`}
          </Button>
        </>
      )}

      {sessionStep === 'run-complete' && (
        <>
          <Button
            borderRadius="lg"
            {...buttonStyles.secondary}
            disabled={!canFinish}
            onClick={() => void onFinish()}
          >
            Finish session
          </Button>
          {!allRunsDone && (
            <Button borderRadius="lg" {...buttonStyles.primary} onClick={onContinue}>
              Next measurement
            </Button>
          )}
        </>
      )}

      {sessionStep !== 'measuring' && (
        <Button
          borderRadius="lg"
          variant="ghost"
          color="gray.400"
          ml="auto"
          onClick={() => void onCancel()}
        >
          Cancel
        </Button>
      )}
    </>
  );
}

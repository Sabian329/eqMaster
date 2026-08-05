import { Dialog, Stack } from '@chakra-ui/react';
import { MeasurementProgress } from '../shared';
import { CompletedRunsList } from './CompletedRunsList';
import { SessionFooter } from './SessionFooter';
import { SessionHeader } from './SessionHeader';
import { MicTestStep } from './steps/MicTestStep';
import { SessionStepContent } from './steps/SessionStepContent';
import type { MeasurementSessionModalProps } from './types';

export function MeasurementSessionModal({ state }: MeasurementSessionModalProps) {
  const {
    sessionOpen,
    sessionStep,
    sessionTargetCount,
    sessionRuns,
    sessionMeterActive,
    sessionMeterDb,
    running,
    statusText,
    progress,
    isTestMode,
    handleSessionSkipMicTest,
    handleSessionStartMeter,
    handleSessionStopMeter,
    handleSessionRunMeasurement,
    handleSessionContinue,
    handleSessionFinish,
    handleSessionCancel,
  } = state;

  const nextRunNumber = sessionRuns.length + 1;
  const canFinish = sessionRuns.length > 0;
  const allRunsDone = sessionRuns.length >= sessionTargetCount;

  return (
    <Dialog.Root
      open={sessionOpen}
      onOpenChange={(details) => {
        if (!details.open) void handleSessionCancel();
      }}
      closeOnInteractOutside={sessionStep !== 'measuring'}
      closeOnEscape={sessionStep !== 'measuring'}
    >
      <Dialog.Backdrop bg="blackAlpha.700" />
      <Dialog.Positioner p={4}>
        <Dialog.Content
          maxW="520px"
          w="full"
          bg="surface.raised"
          borderWidth="1px"
          borderColor="whiteAlpha.200"
          borderRadius="2xl"
          color="gray.100"
          shadow="2xl"
        >
          <SessionHeader state={state} />

          <Dialog.Body py={5}>
            <Stack gap={5}>
              {sessionStep === 'mic-test' && (
                <MicTestStep
                  sessionMeterActive={sessionMeterActive}
                  sessionMeterDb={sessionMeterDb}
                  onStartMeter={handleSessionStartMeter}
                  onStopMeter={handleSessionStopMeter}
                />
              )}

              <SessionStepContent
                sessionStep={sessionStep}
                isTestMode={isTestMode}
                allRunsDone={allRunsDone}
              />

              {(sessionStep === 'measuring' || sessionStep === 'run-complete') && (
                <MeasurementProgress statusText={statusText} progress={progress} />
              )}

              <CompletedRunsList sessionRuns={sessionRuns} />
            </Stack>
          </Dialog.Body>

          <Dialog.Footer
            borderTopWidth="1px"
            borderColor="whiteAlpha.100"
            pt={4}
            gap={2}
            flexWrap="wrap"
          >
            <SessionFooter
              sessionStep={sessionStep}
              running={running}
              canFinish={canFinish}
              allRunsDone={allRunsDone}
              nextRunNumber={nextRunNumber}
              isTestMode={isTestMode}
              onSkipMicTest={handleSessionSkipMicTest}
              onRunMeasurement={handleSessionRunMeasurement}
              onContinue={handleSessionContinue}
              onFinish={handleSessionFinish}
              onCancel={handleSessionCancel}
            />
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

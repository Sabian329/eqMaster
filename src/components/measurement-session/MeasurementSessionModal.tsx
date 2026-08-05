import { Box, Dialog, Stack } from '@chakra-ui/react';
import { modalStyles } from '../../theme';
import { MeasurementProgress } from '../shared';
import { SessionWarningBanner } from './SessionWarningBanner';
import { CompletedRunsList } from './CompletedRunsList';
import { SessionFooter } from './SessionFooter';
import { SessionHeader } from './SessionHeader';
import { MeasurementAuroraPanel } from './MeasurementAuroraPanel';
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
    sessionWarning,
    running,
    statusText,
    progress,
    isTestMode,
    getSessionAudioFrame,
    handleSessionSkipMicTest,
    handleSessionStartMeter,
    handleSessionStopMeter,
    handleSessionRunMeasurement,
    handleSessionRedoMeasurement,
    handleSessionStopMeasurement,
    handleSessionContinue,
    handleSessionFinish,
    handleSessionCancel,
    handleSessionDismissWarning,
  } = state;

  const nextRunNumber = sessionRuns.length + 1;
  const canFinish = sessionRuns.length > 0;
  const allRunsDone = sessionRuns.length >= sessionTargetCount;
  const lastCompletedRunNumber = sessionRuns.length;

  const showProgress = sessionStep === 'measuring' || sessionStep === 'run-complete';

  return (
    <Dialog.Root
      open={sessionOpen}
      onOpenChange={(details) => {
        if (!details.open) void handleSessionCancel();
      }}
      closeOnInteractOutside={sessionStep !== 'measuring'}
      closeOnEscape={sessionStep !== 'measuring'}
      placement="center"
    >
      <Dialog.Backdrop {...modalStyles.backdrop} />
      <Dialog.Positioner {...modalStyles.positioner}>
        <Dialog.Content {...modalStyles.content}>
          <SessionHeader state={state} />

          <Dialog.Body {...modalStyles.bodyScroll}>
            <Stack gap={4} h="full">
              {sessionWarning && (
                <SessionWarningBanner
                  message={sessionWarning}
                  onDismiss={handleSessionDismissWarning}
                />
              )}

              <MeasurementAuroraPanel
                active={sessionStep === 'measuring'}
                getAudioFrame={getSessionAudioFrame}
              />

              <Box {...modalStyles.bodyInner}>
                <Stack gap={4}>
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

                  <Box minH="52px">
                    {showProgress && (
                      <MeasurementProgress statusText={statusText} progress={progress} />
                    )}
                  </Box>

                  <CompletedRunsList
                    sessionRuns={sessionRuns}
                    sessionStep={sessionStep}
                    running={running}
                    onRedoRun={handleSessionRedoMeasurement}
                  />
                </Stack>
              </Box>
            </Stack>
          </Dialog.Body>

          <Dialog.Footer {...modalStyles.footer}>
            <SessionFooter
              sessionStep={sessionStep}
              running={running}
              canFinish={canFinish}
              allRunsDone={allRunsDone}
              nextRunNumber={nextRunNumber}
              lastCompletedRunNumber={lastCompletedRunNumber}
              isTestMode={isTestMode}
              onSkipMicTest={handleSessionSkipMicTest}
              onRunMeasurement={() => void handleSessionRunMeasurement()}
              onStopMeasurement={handleSessionStopMeasurement}
              onRedoMeasurement={handleSessionRedoMeasurement}
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

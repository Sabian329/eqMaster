import { Box, Dialog, Stack } from '@chakra-ui/react';
import { modalStyles } from '../../theme';
import { MeasurementProgress } from '../shared';
import { SessionWarningBanner } from './SessionWarningBanner';
import { CompletedRunsList } from './CompletedRunsList';
import { SessionFooter } from './SessionFooter';
import { SessionHeader } from './SessionHeader';
import { MeasurementAuroraPanel } from './MeasurementAuroraPanel';
import { SessionMeasurementNameFields } from './SessionMeasurementNameFields';
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
    sessionNameTagId,
    setSessionNameTagId,
    sessionNameCustom,
    setSessionNameCustom,
    sessionSaveNamePreview,
  } = state;

  const nextRunNumber = sessionRuns.length + 1;
  const canFinish = sessionRuns.length > 0;
  const allRunsDone = sessionRuns.length >= sessionTargetCount;
  const lastCompletedRunNumber = sessionRuns.length;
  const showNameFields =
    canFinish &&
    (sessionStep === 'ready' || sessionStep === 'run-complete');

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

              {sessionStep === 'measuring' ? (
                <MeasurementAuroraPanel getAudioFrame={getSessionAudioFrame} />
              ) : null}

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

                  {showNameFields ? (
                    <SessionMeasurementNameFields
                      tagId={sessionNameTagId}
                      customLabel={sessionNameCustom}
                      onTagChange={setSessionNameTagId}
                      onCustomLabelChange={setSessionNameCustom}
                      previewName={sessionSaveNamePreview}
                    />
                  ) : null}
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

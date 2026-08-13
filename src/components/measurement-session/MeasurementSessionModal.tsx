import { useEffect, useMemo, useState } from 'react';
import { Box, Dialog, Stack } from '@chakra-ui/react';
import {
  joinMeasurementNameParts,
  resolveMeasurementNamePrefix,
  type MeasurementNamePrefixId,
} from '../../config/measurementNamePrefixes';
import { modalStyles } from '../../theme';
import { buildSavedMeasurementName } from '../../utils/savedMeasurements';
import { MeasurementNameFields, MeasurementProgress } from '../shared';
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
    uadRoutingHint,
    running,
    statusText,
    progress,
    fStart,
    fEnd,
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
  const showSaveName =
    canFinish &&
    (sessionStep === 'ready' || sessionStep === 'run-complete');

  const [prefixId, setPrefixId] = useState<MeasurementNamePrefixId>('room');
  const [customPrefix, setCustomPrefix] = useState('');
  const [saveName, setSaveName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);

  const prefixLabel = useMemo(
    () => resolveMeasurementNamePrefix(prefixId, customPrefix),
    [prefixId, customPrefix],
  );

  const autoSaveName = useMemo(() => {
    const lastMeta = sessionRuns[sessionRuns.length - 1]?.meta;
    const frequencyPart = buildSavedMeasurementName(
      lastMeta?.fMin ?? fStart,
      lastMeta?.fMax ?? fEnd,
      lastMeta?.date ?? new Date(),
    );
    return joinMeasurementNameParts(prefixLabel, frequencyPart);
  }, [sessionRuns, fStart, fEnd, prefixLabel]);

  useEffect(() => {
    if (!sessionOpen) return;
    setPrefixId('room');
    setCustomPrefix('');
    setNameTouched(false);
  }, [sessionOpen]);

  useEffect(() => {
    if (!sessionOpen || nameTouched) return;
    setSaveName(autoSaveName);
  }, [sessionOpen, nameTouched, autoSaveName]);

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
                <MeasurementAuroraPanel
                  active
                  getAudioFrame={getSessionAudioFrame}
                />
              ) : null}

              <Box {...modalStyles.bodyInner}>
                <Stack gap={4}>
                  {sessionStep === 'mic-test' && (
                    <MicTestStep
                      sessionMeterActive={sessionMeterActive}
                      sessionMeterDb={sessionMeterDb}
                      uadRoutingHint={uadRoutingHint}
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

                  {showSaveName ? (
                    <MeasurementNameFields
                      prefixId={prefixId}
                      onPrefixIdChange={(id) => {
                        setNameTouched(false);
                        setPrefixId(id);
                      }}
                      customPrefix={customPrefix}
                      onCustomPrefixChange={(value) => {
                        setNameTouched(false);
                        setCustomPrefix(value);
                      }}
                      name={saveName}
                      onNameChange={(value) => {
                        setNameTouched(true);
                        setSaveName(value);
                      }}
                      helperText="Used when you finish the session and save to the measurement library."
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
              onFinish={() =>
                void handleSessionFinish({
                  name: saveName,
                  prefix: prefixLabel,
                })
              }
              onCancel={handleSessionCancel}
            />
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

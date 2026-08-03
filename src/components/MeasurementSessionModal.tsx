import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  HStack,
  Progress,
  Stack,
  Text,
} from '@chakra-ui/react';
import type { RoomEqState } from '../hooks/useRoomEq';
import { badgeStyles, buttonStyles } from '../theme';
import { dbToMeterPercent, formatDb } from '../utils/format';

interface MeasurementSessionModalProps {
  state: RoomEqState;
}

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

  const stepTitle =
    sessionStep === 'mic-test'
      ? 'Input level check'
      : sessionStep === 'ready'
        ? `Measurement ${nextRunNumber} of ${sessionTargetCount}`
        : sessionStep === 'measuring'
          ? `Running measurement ${nextRunNumber} of ${sessionTargetCount}`
          : `Measurement ${sessionRuns.length} complete`;

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
          <Dialog.Header borderBottomWidth="1px" borderColor="whiteAlpha.100" pb={4}>
            <Stack gap={2}>
              <Dialog.Title fontSize="lg" fontWeight="semibold" color="gray.100">
                Measurement session
              </Dialog.Title>
              <HStack gap={2} flexWrap="wrap">
                <Badge {...badgeStyles.info}>
                  {sessionRuns.length} / {sessionTargetCount} done
                </Badge>
                <Text fontSize="sm" color="gray.400">
                  {stepTitle}
                </Text>
              </HStack>
            </Stack>
          </Dialog.Header>

          <Dialog.Body py={5}>
            <Stack gap={5}>
              {sessionStep === 'mic-test' && (
                <>
                  <Text fontSize="sm" color="gray.300" lineHeight="1.65">
                    Optional: play pink noise at the sweep digital level while monitoring the
                    microphone. Adjust output volume and mic gain live — aim for a peak around
                    −18 to −8 dBFS, then continue.
                  </Text>

                  <Box
                    p={4}
                    borderRadius="xl"
                    borderWidth="1px"
                    borderColor="whiteAlpha.100"
                    bg="whiteAlpha.40"
                  >
                    {!sessionMeterActive ? (
                      <Button
                        size="sm"
                        borderRadius="lg"
                        {...buttonStyles.secondary}
                        onClick={() =>
                          handleSessionStartMeter().catch((error) =>
                            alert(error instanceof Error ? error.message : String(error)),
                          )
                        }
                      >
                        Start level check
                      </Button>
                    ) : (
                      <Stack gap={3}>
                        <Button
                          size="sm"
                          borderRadius="lg"
                          {...buttonStyles.danger}
                          onClick={() => void handleSessionStopMeter()}
                        >
                          Stop level check
                        </Button>
                        <HStack gap={3}>
                          <Box
                            flex={1}
                            h="10px"
                            borderRadius="full"
                            overflow="hidden"
                            borderWidth="1px"
                            borderColor="whiteAlpha.200"
                            bg="linear-gradient(90deg, rgba(85,214,139,.15) 0 72%, rgba(255,191,90,.18) 72% 90%, rgba(255,114,114,.18) 90% 100%)"
                          >
                            <Box
                              h="full"
                              w={`${dbToMeterPercent(sessionMeterDb)}%`}
                              bg="linear-gradient(90deg, #55d68b, #ffbf5a 78%, #ff7272)"
                              transition="width 0.06s linear"
                            />
                          </Box>
                          <Text
                            fontSize="xs"
                            color="gray.300"
                            minW="72px"
                            textAlign="right"
                            fontVariantNumeric="tabular-nums"
                          >
                            {formatDb(sessionMeterDb)}FS
                          </Text>
                        </HStack>
                      </Stack>
                    )}
                  </Box>
                </>
              )}

              {sessionStep === 'ready' && (
                <Text fontSize="sm" color="gray.300" lineHeight="1.65">
                  Keep the microphone still during each sweep. When you are ready, start the
                  next measurement.
                </Text>
              )}

              {sessionStep === 'measuring' && (
                <Text fontSize="sm" color="gray.300" lineHeight="1.65">
                  Sweep in progress — do not move the microphone or change volume.
                </Text>
              )}

              {sessionStep === 'run-complete' && (
                <Text fontSize="sm" color="gray.300" lineHeight="1.65">
                  {allRunsDone
                    ? 'All planned measurements are done. Finish the session to see individual runs and the averaged result.'
                    : 'You can continue with the next measurement or finish now using the completed runs.'}
                </Text>
              )}

              {(sessionStep === 'measuring' || sessionStep === 'run-complete') && (
                <Box>
                  <Flex justify="space-between" fontSize="sm" color="gray.400" mb={2}>
                    <Text color="gray.300">{statusText}</Text>
                    <Text fontVariantNumeric="tabular-nums">{Math.round(progress)}%</Text>
                  </Flex>
                  <Progress.Root value={progress} size="sm">
                    <Progress.Track bg="surface.inset" borderRadius="full" h="9px">
                      <Progress.Range bg="brand.400" borderRadius="full" />
                    </Progress.Track>
                  </Progress.Root>
                </Box>
              )}

              {sessionRuns.length > 0 && (
                <Stack gap={2}>
                  <Text fontSize="xs" fontWeight="medium" color="gray.500">
                    Completed in this session
                  </Text>
                  <HStack gap={2} flexWrap="wrap">
                    {sessionRuns.map((run) => (
                      <Badge key={run.index} {...badgeStyles.info}>
                        {run.label}
                      </Badge>
                    ))}
                  </HStack>
                </Stack>
              )}
            </Stack>
          </Dialog.Body>

          <Dialog.Footer
            borderTopWidth="1px"
            borderColor="whiteAlpha.100"
            pt={4}
            gap={2}
            flexWrap="wrap"
          >
            {sessionStep === 'mic-test' && (
              <>
                <Button
                  borderRadius="lg"
                  {...buttonStyles.secondary}
                  onClick={handleSessionSkipMicTest}
                >
                  Skip
                </Button>
                <Button
                  borderRadius="lg"
                  {...buttonStyles.primary}
                  onClick={handleSessionSkipMicTest}
                >
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
                  onClick={() => void handleSessionFinish()}
                >
                  Finish session
                </Button>
                <Button
                  borderRadius="lg"
                  {...buttonStyles.primary}
                  disabled={running}
                  onClick={() =>
                    handleSessionRunMeasurement().catch((error) =>
                      alert(error instanceof Error ? error.message : String(error)),
                    )
                  }
                >
                  Start measurement {nextRunNumber}
                </Button>
              </>
            )}

            {sessionStep === 'run-complete' && (
              <>
                <Button
                  borderRadius="lg"
                  {...buttonStyles.secondary}
                  disabled={!canFinish}
                  onClick={() => void handleSessionFinish()}
                >
                  Finish session
                </Button>
                {!allRunsDone && (
                  <Button
                    borderRadius="lg"
                    {...buttonStyles.primary}
                    onClick={handleSessionContinue}
                  >
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
                onClick={() => void handleSessionCancel()}
              >
                Cancel
              </Button>
            )}
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

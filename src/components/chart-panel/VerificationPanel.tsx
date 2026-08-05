import { Box, Button, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import type { RoomEqState } from '../../hooks/useRoomEq';
import { buttonStyles, setupSectionStyles } from '../../theme';
import { MeasurementProgress } from '../shared';

interface VerificationPanelProps {
  state: Pick<
    RoomEqState,
    | 'curve'
    | 'verificationCurve'
    | 'verificationMeta'
    | 'verificationRunning'
    | 'canApplyVerificationEq'
    | 'verifyEnabled'
    | 'activeFilterCount'
    | 'presetPreamp'
    | 'statusText'
    | 'progress'
    | 'isTestMode'
    | 'runVerificationMeasurement'
    | 'clearVerification'
  >;
}

export function VerificationPanel({ state }: VerificationPanelProps) {
  const {
    curve,
    verificationCurve,
    verificationMeta,
    verificationRunning,
    canApplyVerificationEq,
    verifyEnabled,
    activeFilterCount,
    presetPreamp,
    statusText,
    progress,
    isTestMode,
    runVerificationMeasurement,
    clearVerification,
  } = state;

  if (!curve.length) return null;

  const hasVerification = Boolean(verificationCurve?.length);

  return (
    <Box
      px={{ base: 3, md: 4 }}
      py={3}
      borderTopWidth="1px"
      borderColor="whiteAlpha.100"
      bg="rgba(12,16,24,.85)"
    >
      <Stack gap={3}>
        <Flex justify="space-between" align="flex-start" gap={3} flexWrap="wrap">
          <Stack gap={1} flex="1 1 280px">
            <Text fontSize="sm" fontWeight="semibold" color="gray.100">
              Verify correction (optional)
            </Text>
            <Text fontSize="xs" color="gray.500" lineHeight="1.6" maxW="640px">
              Orange <Text as="span" color="#ff9f6b">After EQ</Text> is a live
              preview. Run verification to play the sweep through your current EQ
              settings and re-measure — the green{' '}
              <Text as="span" color="#55d68b">Verified</Text> line shows the real
              result in the room.
            </Text>
          </Stack>
          <HStack gap={2} flexWrap="wrap">
            {hasVerification && (
              <Button
                size="sm"
                borderRadius="lg"
                variant="ghost"
                color="gray.400"
                _hover={{ color: 'gray.200', bg: 'whiteAlpha.80' }}
                disabled={verificationRunning}
                onClick={clearVerification}
              >
                Clear verification
              </Button>
            )}
            <Button
              size="sm"
              borderRadius="lg"
              disabled={!verifyEnabled}
              {...buttonStyles.primary}
              onClick={() =>
                runVerificationMeasurement().catch((error) =>
                  alert(error instanceof Error ? error.message : String(error)),
                )
              }
            >
              {verificationRunning ? 'Verifying…' : 'Verify correction'}
            </Button>
          </HStack>
        </Flex>

        {!canApplyVerificationEq && (
          <Text fontSize="xs" color="gray.600">
            Enable at least one filter or set a non-zero preamp to verify.
          </Text>
        )}

        {canApplyVerificationEq && !verifyEnabled && !verificationRunning && !isTestMode && (
          <Text fontSize="xs" color="gray.600">
            Complete the safety checklist in the setup panel before verifying live.
          </Text>
        )}

        {verificationRunning && (
          <MeasurementProgress statusText={statusText} progress={progress} />
        )}

        {hasVerification && verificationMeta && !verificationRunning && (
          <Box {...setupSectionStyles.summaryStrip}>
            <Text {...setupSectionStyles.summaryLabel}>Last verification</Text>
            <HStack gap={2} flexWrap="wrap">
              <SummaryChip
                label="Filters"
                value={`${activeFilterCount}${Math.abs(presetPreamp) > 0.01 ? ` + ${presetPreamp.toFixed(1)} dB preamp` : ''}`}
              />
              <SummaryChip
                label="Recorded"
                value={new Date(verificationMeta.date).toLocaleString()}
              />
            </HStack>
          </Box>
        )}
      </Stack>
    </Box>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <HStack
      gap={2}
      px={3}
      py={1.5}
      borderRadius="lg"
      borderWidth="1px"
      borderColor="whiteAlpha.100"
      bg="rgba(0,0,0,.22)"
    >
      <Text fontSize="2xs" color="gray.500" textTransform="uppercase" letterSpacing="0.06em">
        {label}
      </Text>
      <Text fontSize="xs" fontWeight="semibold" color="gray.200">
        {value}
      </Text>
    </HStack>
  );
}

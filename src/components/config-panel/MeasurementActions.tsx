import { Box, Button, Checkbox, SimpleGrid, Text } from '@chakra-ui/react';
import { buttonStyles } from '../../theme';
import { MeasurementProgress } from '../shared';
import type { MeasurementActionsProps } from './types';

export function MeasurementActions({ state }: MeasurementActionsProps) {
  const {
    safetyCheck,
    setSafetyCheck,
    measureEnabled,
    isTestMode,
    handleStartSession,
    statusText,
    progress,
  } = state;

  return (
    <>
      <SimpleGrid columns={{ base: 1, lg: 2 }} gap={4} alignItems="center">
        {isTestMode ? (
          <Box
            p={4}
            borderRadius="xl"
            borderWidth="1px"
            borderColor="rgba(255, 191, 90, 0.35)"
            bg="rgba(255, 191, 90, 0.08)"
          >
            <Text fontSize="sm" lineHeight="1.55" color="gray.300">
              Test mode generates a synthetic response with known room issues. No safety
              checklist or audio hardware is required.
            </Text>
          </Box>
        ) : (
          <Box
            p={4}
            borderRadius="xl"
            borderWidth="1px"
            borderColor="whiteAlpha.100"
            bg="whiteAlpha.30"
          >
            <Checkbox.Root
              checked={safetyCheck}
              onCheckedChange={(details) => setSafetyCheck(!!details.checked)}
              alignItems="flex-start"
              gap={3}
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control
                mt={0.5}
                borderColor="whiteAlpha.300"
                _checked={{ bg: 'brand.400', borderColor: 'brand.400' }}
              />
              <Checkbox.Label fontSize="sm" lineHeight="1.55" color="gray.300">
                I set a low volume, disabled direct monitoring, and the microphone is not
                positioned where feedback is likely.
              </Checkbox.Label>
            </Checkbox.Root>
          </Box>
        )}

        <Button
          size="lg"
          borderRadius="xl"
          disabled={!measureEnabled}
          {...buttonStyles.primary}
          onClick={() => handleStartSession().catch((e) => alert(e.message))}
        >
          {isTestMode ? 'Run test measurement' : 'Start measurement'}
        </Button>
      </SimpleGrid>

      <MeasurementProgress statusText={statusText} progress={progress} />

      <Text fontSize="xs" color="gray.500" lineHeight="1.65">
        The chart is relative: the ~500–2000 Hz range is normalized to 0 dB. Without an SPL
        calibrator, the app does not show exact in-room loudness.
      </Text>
    </>
  );
}

import { Box, Button, Checkbox, Flex, Stack, Text } from '@chakra-ui/react';
import { buttonStyles, launchPanelStyles } from '../../theme';
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
    <Box {...launchPanelStyles.root}>
      <Flex
        direction={{ base: 'column', lg: 'row' }}
        gap={5}
        align={{ base: 'stretch', lg: 'center' }}
        justify="space-between"
      >
        <Stack gap={2} flex={1}>
          <Text {...launchPanelStyles.title}>
            {isTestMode ? 'Ready to generate mock data' : 'Ready to measure'}
          </Text>
          {isTestMode ? (
            <Text {...launchPanelStyles.subtitle}>
              Test mode uses a synthetic room response with known peaks and dips. No safety
              checklist or audio hardware is required.
            </Text>
          ) : (
            <Checkbox.Root
              checked={safetyCheck}
              onCheckedChange={(details) => setSafetyCheck(!!details.checked)}
              alignItems="flex-start"
              gap={3}
              maxW="560px"
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control
                mt={0.5}
                borderColor="whiteAlpha.300"
                bg="rgba(0,0,0,.25)"
                _checked={{ bg: 'brand.400', borderColor: 'brand.400' }}
              />
              <Checkbox.Label fontSize="sm" lineHeight="1.6" color="gray.400">
                Volume is low, direct monitoring is off, and the microphone is positioned
                safely away from feedback.
              </Checkbox.Label>
            </Checkbox.Root>
          )}
        </Stack>

        <Button
          size="lg"
          minW={{ lg: '220px' }}
          h="52px"
          borderRadius="xl"
          disabled={!measureEnabled}
          {...buttonStyles.primary}
          fontSize="md"
          onClick={() => handleStartSession().catch((e) => alert(e.message))}
        >
          {isTestMode ? 'Run test session' : 'Start live session'}
        </Button>
      </Flex>

      <Box mt={5} pt={4} borderTopWidth="1px" borderColor="whiteAlpha.80">
        <MeasurementProgress statusText={statusText} progress={progress} />
        <Text fontSize="xs" color="gray.600" lineHeight="1.65" mt={3}>
          Relative display: the ~500–2000 Hz range is normalized to 0 dB. Without an SPL
          calibrator, absolute in-room loudness is not shown.
        </Text>
      </Box>
    </Box>
  );
}

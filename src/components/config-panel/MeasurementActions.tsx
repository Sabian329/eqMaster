import { Box, Button, Checkbox, Flex, Stack, Text } from '@chakra-ui/react';
import { buttonStyles, launchPanelStyles, ui } from '../../theme';
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
                borderColor={ui.colors.borderStrong}
                borderRadius="2px"
                bg={ui.colors.inset}
                _checked={{ bg: ui.colors.accent, borderColor: ui.colors.accent }}
              />
              <Checkbox.Label fontSize="xs" lineHeight="1.6" color={ui.colors.textMuted}>
                Volume is low, direct monitoring is off, and the microphone is positioned
                safely away from feedback.
              </Checkbox.Label>
            </Checkbox.Root>
          )}
        </Stack>

        <Button
          size="lg"
          minW={{ lg: '220px' }}
          h="48px"
          borderRadius="2px"
          disabled={!measureEnabled}
          {...buttonStyles.primary}
          fontSize="sm"
          onClick={() => handleStartSession().catch((e) => alert(e.message))}
        >
          {isTestMode ? 'Run test session' : 'Start live session'}
        </Button>
      </Flex>

      <Box mt={4} pt={3} borderTopWidth="1px" borderColor={ui.colors.border}>
        <MeasurementProgress statusText={statusText} progress={progress} />
        <Text fontSize="2xs" color={ui.colors.textDim} lineHeight="1.65" mt={2} fontFamily={ui.fonts.mono}>
          Relative display: the ~500–2000 Hz range is normalized to 0 dB. Without an SPL
          calibrator, absolute in-room loudness is not shown.
        </Text>
      </Box>
    </Box>
  );
}

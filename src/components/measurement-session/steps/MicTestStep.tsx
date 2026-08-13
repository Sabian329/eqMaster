import { Box, Button, Stack, Text } from '@chakra-ui/react';
import type { RoomEqState } from '../../../hooks/useRoomEq';
import { meterOptimalRangeLabel } from '../../../utils/format';
import { buttonStyles, modalStyles } from '../../../theme';
import { LevelMeter } from '../../shared';
import { StatusAlert } from '../../ui/StatusAlert';

interface MicTestStepProps {
  sessionMeterActive: boolean;
  sessionMeterDb: number;
  uadRoutingHint?: string | null;
  onStartMeter: RoomEqState['handleSessionStartMeter'];
  onStopMeter: RoomEqState['handleSessionStopMeter'];
}

export function MicTestStep({
  sessionMeterActive,
  sessionMeterDb,
  uadRoutingHint,
  onStartMeter,
  onStopMeter,
}: MicTestStepProps) {
  return (
    <>
      <Text {...modalStyles.subtitle} lineHeight="1.65">
        First monitor the input with no playback. Tap or talk into the microphone —
        the meter should move. Then optionally play pink noise to set gain (
        {meterOptimalRangeLabel()}).
      </Text>

      {uadRoutingHint ? (
        <StatusAlert
          status="warning"
          size="sm"
          title="Tap the mic — not the speakers"
          description="If the meter stays still when you tap the microphone but jumps when speakers play, this capture is likely Apollo Virtual/LOOPBACK, not the analog mic. Change Capture channel or Console routing."
        />
      ) : null}

      <Box {...modalStyles.inset}>
        {!sessionMeterActive ? (
          <Stack gap={2}>
            <Button
              size="sm"
              {...buttonStyles.secondary}
              {...modalStyles.actionButton}
              onClick={() => void onStartMeter({ playStimulus: false })}
            >
              Monitor input
            </Button>
            <Button
              size="sm"
              {...buttonStyles.secondary}
              {...modalStyles.actionButton}
              onClick={() => void onStartMeter({ playStimulus: true })}
            >
              Level check with pink noise
            </Button>
          </Stack>
        ) : (
          <Stack gap={3}>
            <Button
              size="sm"
              {...buttonStyles.danger}
              {...modalStyles.actionButton}
              onClick={() => void onStopMeter()}
            >
              Stop
            </Button>
            <LevelMeter meterDb={sessionMeterDb} />
            <Text fontSize="2xs" color="gray.500" lineHeight="1.55">
              Mic tap should move the meter. Speaker playback should not, unless
              you started a pink-noise level check.
            </Text>
          </Stack>
        )}
      </Box>
    </>
  );
}

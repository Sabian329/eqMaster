import { Box, Button, Stack, Text } from '@chakra-ui/react';
import type { RoomEqState } from '../../../hooks/useRoomEq';
import { meterOptimalRangeLabel } from '../../../utils/format';
import { buttonStyles, modalStyles } from '../../../theme';
import { LevelMeter } from '../../shared';

interface MicTestStepProps {
  sessionMeterActive: boolean;
  sessionMeterDb: number;
  onStartMeter: RoomEqState['handleSessionStartMeter'];
  onStopMeter: RoomEqState['handleSessionStopMeter'];
}

export function MicTestStep({
  sessionMeterActive,
  sessionMeterDb,
  onStartMeter,
  onStopMeter,
}: MicTestStepProps) {
  return (
    <>
      <Text {...modalStyles.subtitle} lineHeight="1.65">
        Optional: play pink noise at the sweep digital level while monitoring the microphone.
        Adjust output volume and mic gain live — aim for the green zone (
        {meterOptimalRangeLabel()}), then continue.
      </Text>

      <Box {...modalStyles.inset}>
        {!sessionMeterActive ? (
          <Button
            size="sm"
            {...buttonStyles.secondary}
            {...modalStyles.actionButton}
            onClick={() => void onStartMeter()}
          >
            Start level check
          </Button>
        ) : (
          <Stack gap={3}>
            <Button
              size="sm"
              {...buttonStyles.danger}
              {...modalStyles.actionButton}
              onClick={() => void onStopMeter()}
            >
              Stop level check
            </Button>
            <LevelMeter meterDb={sessionMeterDb} />
          </Stack>
        )}
      </Box>
    </>
  );
}

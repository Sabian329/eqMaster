import { Box, Button, Stack, Text } from '@chakra-ui/react';
import type { RoomEqState } from '../../../hooks/useRoomEq';
import { buttonStyles } from '../../../theme';
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
      <Text fontSize="sm" color="gray.300" lineHeight="1.65">
        Optional: play pink noise at the sweep digital level while monitoring the microphone.
        Adjust output volume and mic gain live — aim for a peak around −18 to −8 dBFS, then
        continue.
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
              onStartMeter().catch((error) =>
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

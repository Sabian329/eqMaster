import { Button, HStack, Text } from '@chakra-ui/react';
import type { RoomEqState } from '../../hooks/useRoomEq';
import { buttonStyles } from '../../theme';

interface DeviceActionButtonsProps {
  env: RoomEqState['env'];
  sinkHelp: string;
  disabled?: boolean;
  onRequestPermission: RoomEqState['handleRequestPermission'];
  onChooseOutput: RoomEqState['handleChooseOutput'];
  onRefreshDevices: RoomEqState['handleRefreshDevices'];
}

export function DeviceActionButtons({
  env,
  sinkHelp,
  disabled = false,
  onRequestPermission,
  onChooseOutput,
  onRefreshDevices,
}: DeviceActionButtonsProps) {
  return (
    <HStack gap={2} flexWrap="wrap" align="center">
      <Button
        size="sm"
        borderRadius="lg"
        {...buttonStyles.secondary}
        disabled={disabled}
        onClick={() => onRequestPermission().catch((e) => alert(e.message))}
      >
        Grant mic access
      </Button>
      <Button
        size="sm"
        borderRadius="lg"
        {...buttonStyles.secondary}
        disabled={disabled || !env.supportsOutputPicker}
        title={sinkHelp}
        onClick={() =>
          onChooseOutput().catch((e) => {
            if (e?.name !== 'NotAllowedError') alert(e.message);
          })
        }
      >
        Choose output
      </Button>
      <Button
        size="sm"
        borderRadius="lg"
        variant="ghost"
        color="gray.400"
        fontWeight="medium"
        _hover={{ color: 'gray.200', bg: 'whiteAlpha.80' }}
        disabled={disabled}
        onClick={() => onRefreshDevices().catch((e) => alert(e.message))}
      >
        Refresh list
      </Button>
      {!env.supportsSink && (
        <Text fontSize="2xs" color="gray.600">
          Output selection limited in this browser
        </Text>
      )}
    </HStack>
  );
}

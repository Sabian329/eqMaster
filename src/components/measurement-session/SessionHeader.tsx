import { Badge, HStack, Stack, Text } from '@chakra-ui/react';
import { Dialog } from '@chakra-ui/react';
import { badgeStyles } from '../../theme';
import type { RoomEqState } from '../../hooks/useRoomEq';
import { getSessionStepTitle } from './utils';

interface SessionHeaderProps {
  state: Pick<
    RoomEqState,
    'isTestMode' | 'sessionStep' | 'sessionRuns' | 'sessionTargetCount'
  >;
}

export function SessionHeader({ state }: SessionHeaderProps) {
  const { isTestMode, sessionStep, sessionRuns, sessionTargetCount } = state;
  const nextRunNumber = sessionRuns.length + 1;

  return (
    <Dialog.Header borderBottomWidth="1px" borderColor="whiteAlpha.100" pb={4}>
      <Stack gap={2}>
        <Dialog.Title fontSize="lg" fontWeight="semibold" color="gray.100">
          {isTestMode ? 'Test session' : 'Measurement session'}
        </Dialog.Title>
        <HStack gap={2} flexWrap="wrap">
          {isTestMode && (
            <Badge
              bg="rgba(255,191,90,.16)"
              color="#ffd28c"
              borderWidth="1px"
              borderColor="rgba(255,191,90,.35)"
              borderRadius="md"
              px={2}
              py={0.5}
              fontSize="xs"
              fontWeight="semibold"
            >
              Mock data
            </Badge>
          )}
          <Badge {...badgeStyles.info}>
            {sessionRuns.length} / {sessionTargetCount} done
          </Badge>
          <Text fontSize="sm" color="gray.400">
            {getSessionStepTitle(
              sessionStep,
              isTestMode,
              nextRunNumber,
              sessionTargetCount,
              sessionRuns.length,
            )}
          </Text>
        </HStack>
      </Stack>
    </Dialog.Header>
  );
}

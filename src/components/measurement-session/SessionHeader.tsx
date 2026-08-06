import { Badge, HStack, Stack, Text } from '@chakra-ui/react';
import { Dialog } from '@chakra-ui/react';
import { badgeStyles, modalStyles } from '../../theme';
import type { RoomEqState } from '../../hooks/useRoomEq';
import { getSessionStepTitle } from './utils';

interface SessionHeaderProps {
  state: Pick<
    RoomEqState,
    | 'sessionStep'
    | 'sessionRuns'
    | 'sessionTargetCount'
    | 'sessionMeasuringRunIndex'
  >;
}

export function SessionHeader({ state }: SessionHeaderProps) {
  const {
    sessionStep,
    sessionRuns,
    sessionTargetCount,
    sessionMeasuringRunIndex,
  } = state;
  const nextRunNumber = sessionRuns.length + 1;
  const isRedoRun =
    sessionStep === 'measuring' &&
    sessionMeasuringRunIndex !== null &&
    sessionMeasuringRunIndex <= sessionRuns.length;

  return (
    <Dialog.Header {...modalStyles.header}>
      <Stack gap={2}>
        <Dialog.Title {...modalStyles.title}>Measurement session</Dialog.Title>
        <HStack gap={2} flexWrap="wrap">
          <Badge {...badgeStyles.info}>
            {sessionRuns.length} / {sessionTargetCount} done
          </Badge>
          <Text {...modalStyles.subtitle}>
            {getSessionStepTitle(
              sessionStep,
              nextRunNumber,
              sessionTargetCount,
              sessionRuns.length,
              sessionMeasuringRunIndex,
              isRedoRun,
            )}
          </Text>
        </HStack>
      </Stack>
    </Dialog.Header>
  );
}

import { Badge, HStack, Stack, Text } from '@chakra-ui/react';
import { Dialog } from '@chakra-ui/react';
import { badgeStyles, modalStyles, ui } from '../../theme';
import type { RoomEqState } from '../../hooks/useRoomEq';
import { getSessionStepTitle } from './utils';

interface SessionHeaderProps {
  state: Pick<
    RoomEqState,
    | 'isTestMode'
    | 'sessionStep'
    | 'sessionRuns'
    | 'sessionTargetCount'
    | 'sessionMeasuringRunIndex'
  >;
}

export function SessionHeader({ state }: SessionHeaderProps) {
  const {
    isTestMode,
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
        <Dialog.Title {...modalStyles.title}>
          {isTestMode ? 'Test session' : 'Measurement session'}
        </Dialog.Title>
        <HStack gap={2} flexWrap="wrap">
          {isTestMode && (
            <Badge
              bg="rgba(230,180,80,.12)"
              color={ui.colors.warn}
              borderWidth="1px"
              borderColor="rgba(230,180,80,.35)"
              borderRadius={ui.radius.sm}
              px={2}
              py={0.5}
              fontSize="2xs"
              fontWeight="700"
              letterSpacing="0.06em"
              textTransform="uppercase"
            >
              Mock data
            </Badge>
          )}
          <Badge {...badgeStyles.info}>
            {sessionRuns.length} / {sessionTargetCount} done
          </Badge>
          <Text {...modalStyles.subtitle}>
            {getSessionStepTitle(
              sessionStep,
              isTestMode,
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

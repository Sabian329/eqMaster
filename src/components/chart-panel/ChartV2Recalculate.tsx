import { Button, Flex, Text } from '@chakra-ui/react';
import type { RoomEqState } from '../../hooks/useRoomEq';
import { buttonStyles, ui } from '../../theme';

interface ChartV2RecalculateProps {
  state: Pick<
    RoomEqState,
    | 'eqAlgorithmVersion'
    | 'recalculateV2AutoEq'
    | 'autoEqV2Progress'
    | 'autoEqV2IsRunning'
    | 'autoEqV2LastPrecision'
    | 'curve'
  >;
}

export function ChartV2Recalculate({ state }: ChartV2RecalculateProps) {
  const {
    eqAlgorithmVersion,
    recalculateV2AutoEq,
    autoEqV2Progress,
    autoEqV2IsRunning,
    autoEqV2LastPrecision,
    curve,
  } = state;

  if (eqAlgorithmVersion !== 'v2' || curve.length === 0) {
    return null;
  }

  const progressLabel = autoEqV2Progress
    ? `${autoEqV2Progress.stage} ${Math.round(autoEqV2Progress.progress * 100)}%`
    : autoEqV2LastPrecision === 'high'
      ? 'High precision'
      : 'Standard';

  return (
    <Flex
      justify="flex-end"
      align="center"
      gap={3}
      px={3}
      py={2}
      borderTopWidth="1px"
      borderColor={ui.colors.border}
      bg={ui.colors.chart}
    >
      <Text fontSize="2xs" color={ui.colors.textDim} fontFamily={ui.fonts.mono}>
        {autoEqV2IsRunning ? `V2 · ${progressLabel}` : `V2 · ${progressLabel}`}
      </Text>
      <Button
        size="sm"
        h="30px"
        borderRadius="2px"
        {...buttonStyles.primary}
        disabled={autoEqV2IsRunning}
        onClick={recalculateV2AutoEq}
      >
        Recalculate
      </Button>
    </Flex>
  );
}

export function ChartV2RecalculateFromState({
  state,
}: {
  state: ChartV2RecalculateProps['state'];
}) {
  return <ChartV2Recalculate state={state} />;
}

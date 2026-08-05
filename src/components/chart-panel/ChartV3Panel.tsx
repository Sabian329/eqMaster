import { Button, Collapsible, Flex, Stack, Text } from '@chakra-ui/react';
import type { RoomEqState } from '../../hooks/useRoomEq';
import { buttonStyles, ui } from '../../theme';

interface ChartV3PanelProps {
  state: Pick<
    RoomEqState,
    | 'eqAlgorithmVersion'
    | 'recalculateV3AutoEq'
    | 'autoEqV3Progress'
    | 'autoEqV3IsRunning'
    | 'autoEqV3Result'
    | 'curve'
  >;
}

function formatStopReason(reason: string): string {
  return reason.replace(/-/g, ' ');
}

export function ChartV3Panel({ state }: ChartV3PanelProps) {
  const {
    eqAlgorithmVersion,
    recalculateV3AutoEq,
    autoEqV3Progress,
    autoEqV3IsRunning,
    autoEqV3Result,
    curve,
  } = state;

  if (eqAlgorithmVersion !== 'v3' || curve.length === 0) {
    return null;
  }

  const v3 = autoEqV3Result?.v3;
  const progressLabel = autoEqV3Progress
    ? `${autoEqV3Progress.stage} ${Math.round(autoEqV3Progress.progress * 100)}%`
    : 'Standard';

  return (
    <Stack gap={0} borderTopWidth="1px" borderColor={ui.colors.border} bg={ui.colors.chart}>
      <Flex justify="flex-end" align="center" gap={3} px={3} py={2}>
        <Text fontSize="2xs" color={ui.colors.textDim} fontFamily={ui.fonts.mono}>
          {autoEqV3IsRunning ? `V3 · ${progressLabel}` : `V3 · ${progressLabel}`}
        </Text>
        <Button
          size="sm"
          h="30px"
          borderRadius="2px"
          {...buttonStyles.primary}
          disabled={autoEqV3IsRunning}
          onClick={recalculateV3AutoEq}
        >
          Recalculate
        </Button>
      </Flex>

      {v3 && (
        <Collapsible.Root defaultOpen={false}>
          <Collapsible.Trigger asChild>
            <Button
              variant="ghost"
              w="full"
              justifyContent="flex-start"
              borderRadius={0}
              borderTopWidth="1px"
              borderColor={ui.colors.border}
              color={ui.colors.textMuted}
              fontSize="2xs"
              fontFamily={ui.fonts.mono}
              px={3}
              py={2}
            >
              V3 diagnostics
            </Button>
          </Collapsible.Trigger>
          <Collapsible.Content px={3} pb={3}>
            <Stack
              gap={1}
              fontSize="2xs"
              color={ui.colors.textMuted}
              fontFamily={ui.fonts.mono}
            >
              <Text>Filters used: {v3.filters.length}</Text>
              <Text>
                Candidates: {v3.candidateCount.total} (R {v3.candidateCount.resonance} · T{' '}
                {v3.candidateCount.tonal} · S {v3.candidateCount.shelf})
              </Text>
              <Text>RMS before: {v3.weightedRmsBeforeDb.toFixed(2)} dB</Text>
              <Text>RMS after: {v3.weightedRmsAfterDb.toFixed(2)} dB</Text>
              <Text>Improvement: {v3.rmsImprovementPercent.toFixed(1)}%</Text>
              <Text>Stop reason: {formatStopReason(v3.stopReason)}</Text>
              <Text>Rejected nulls: {v3.rejectedNullCount}</Text>
              <Text>Pruned filters: {v3.prunedFilterCount}</Text>
              <Text>Merged filters: {v3.mergedFilterCount}</Text>
              <Text>Maximum EQ boost: {v3.maximumCombinedBoostDb.toFixed(2)} dB</Text>
              <Text>Preamp: {v3.preampDb.toFixed(2)} dB</Text>
              <Text>Execution time: {v3.executionTimeMs.toFixed(0)} ms</Text>
            </Stack>
          </Collapsible.Content>
        </Collapsible.Root>
      )}
    </Stack>
  );
}

export function ChartV3PanelFromState({
  state,
}: {
  state: ChartV3PanelProps['state'];
}) {
  return <ChartV3Panel state={state} />;
}

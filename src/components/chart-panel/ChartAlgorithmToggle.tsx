import { Stack, Tabs, Text } from '@chakra-ui/react';
import type { RoomEqState } from '../../hooks/useRoomEq';
import { EQ_ALGORITHMS, type EqAlgorithmVersion } from '../../config/eqAlgorithms';
import { tabStyles, ui } from '../../theme';

interface ChartAlgorithmToggleProps {
  eqAlgorithmVersion: EqAlgorithmVersion;
  setEqAlgorithmVersion: (version: EqAlgorithmVersion) => void;
  autoEqV2Progress?: RoomEqState['autoEqV2Progress'];
  autoEqV3Progress?: RoomEqState['autoEqV3Progress'];
}

export function ChartAlgorithmToggle({
  eqAlgorithmVersion,
  setEqAlgorithmVersion,
  autoEqV2Progress,
  autoEqV3Progress,
}: ChartAlgorithmToggleProps) {
  const active = EQ_ALGORITHMS.find((item) => item.id === eqAlgorithmVersion) ?? EQ_ALGORITHMS[0];

  return (
    <Stack gap={1.5} mb={3}>
      <Tabs.Root
        value={eqAlgorithmVersion}
        onValueChange={(details) => setEqAlgorithmVersion(details.value as EqAlgorithmVersion)}
        variant="enclosed"
      >
        <Tabs.List {...tabStyles.list} maxW="420px">
          {EQ_ALGORITHMS.map((algorithm) => (
            <Tabs.Trigger
              key={algorithm.id}
              value={algorithm.id}
              {...tabStyles.trigger}
              flex={1}
            >
              {algorithm.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs.Root>
      <Text fontSize="2xs" color={ui.colors.textDim} fontFamily={ui.fonts.mono} pl={0.5}>
        {active.description}
      </Text>
      <Text
        fontSize="2xs"
        color={ui.colors.accent}
        fontFamily={ui.fonts.mono}
        pl={0.5}
        h="1.25em"
        lineHeight="1.25em"
        visibility={
          (eqAlgorithmVersion === 'v2' && autoEqV2Progress) ||
          (eqAlgorithmVersion === 'v3' && autoEqV3Progress)
            ? 'visible'
            : 'hidden'
        }
        aria-hidden={
          !(
            (eqAlgorithmVersion === 'v2' && autoEqV2Progress) ||
            (eqAlgorithmVersion === 'v3' && autoEqV3Progress)
          )
        }
      >
        {eqAlgorithmVersion === 'v2' && autoEqV2Progress
          ? `V2 ${autoEqV2Progress.stage}… ${Math.round(autoEqV2Progress.progress * 100)}%`
          : eqAlgorithmVersion === 'v3' && autoEqV3Progress
            ? `V3 ${autoEqV3Progress.stage}… ${Math.round(autoEqV3Progress.progress * 100)}%`
            : '\u00a0'}
      </Text>
    </Stack>
  );
}

export function ChartAlgorithmToggleFromState({
  state,
}: {
  state: Pick<
    RoomEqState,
    | 'eqAlgorithmVersion'
    | 'setEqAlgorithmVersion'
    | 'autoEqV2Progress'
    | 'autoEqV3Progress'
  >;
}) {
  return (
    <ChartAlgorithmToggle
      eqAlgorithmVersion={state.eqAlgorithmVersion}
      setEqAlgorithmVersion={state.setEqAlgorithmVersion}
      autoEqV2Progress={state.autoEqV2Progress}
      autoEqV3Progress={state.autoEqV3Progress}
    />
  );
}

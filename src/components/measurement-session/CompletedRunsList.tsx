import { Badge, Button, HStack, Stack, Text } from '@chakra-ui/react';
import type { MeasurementRun, MeasurementSessionStep } from '../../types';
import { badgeStyles, buttonStyles, ui } from '../../theme';

interface CompletedRunsListProps {
  sessionRuns: MeasurementRun[];
  sessionStep: MeasurementSessionStep;
  running: boolean;
  onRedoRun?: (runIndex: number) => void;
}

export function CompletedRunsList({
  sessionRuns,
  sessionStep,
  running,
  onRedoRun,
}: CompletedRunsListProps) {
  if (!sessionRuns.length) return null;

  const canRedo =
    !running &&
    onRedoRun &&
    (sessionStep === 'run-complete' || sessionStep === 'ready');

  return (
    <Stack gap={2}>
      <Text
        fontSize="2xs"
        fontWeight="700"
        color={ui.colors.textDim}
        letterSpacing="0.08em"
        textTransform="uppercase"
        fontFamily={ui.fonts.mono}
      >
        Completed in this session
      </Text>
      <Stack gap={2}>
        {sessionRuns.map((run) => (
          <HStack key={run.index} gap={2} flexWrap="wrap">
            <Badge {...badgeStyles.info}>{run.label}</Badge>
            {canRedo && (
              <Button
                size="xs"
                {...buttonStyles.secondary}
                h="24px"
                px={2}
                fontSize="2xs"
                onClick={() => onRedoRun(run.index)}
              >
                Redo
              </Button>
            )}
          </HStack>
        ))}
      </Stack>
    </Stack>
  );
}

import { Badge, HStack, Stack, Text } from '@chakra-ui/react';
import type { MeasurementRun } from '../../types';
import { badgeStyles } from '../../theme';

interface CompletedRunsListProps {
  sessionRuns: MeasurementRun[];
}

export function CompletedRunsList({ sessionRuns }: CompletedRunsListProps) {
  if (!sessionRuns.length) return null;

  return (
    <Stack gap={2}>
      <Text fontSize="xs" fontWeight="medium" color="gray.500">
        Completed in this session
      </Text>
      <HStack gap={2} flexWrap="wrap">
        {sessionRuns.map((run) => (
          <Badge key={run.index} {...badgeStyles.info}>
            {run.label}
          </Badge>
        ))}
      </HStack>
    </Stack>
  );
}

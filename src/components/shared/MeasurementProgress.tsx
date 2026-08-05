import { Box, Flex, Progress, Text } from '@chakra-ui/react';
import { ui } from '../../theme';

interface MeasurementProgressProps {
  statusText: string;
  progress: number;
}

export function MeasurementProgress({ statusText, progress }: MeasurementProgressProps) {
  return (
    <Box>
      <Flex justify="space-between" fontSize="xs" color={ui.colors.textMuted} mb={2} fontFamily={ui.fonts.mono}>
        <Text color={ui.colors.text}>{statusText}</Text>
        <Text fontVariantNumeric="tabular-nums">{Math.round(progress)}%</Text>
      </Flex>
      <Progress.Root value={progress} size="sm">
        <Progress.Track bg={ui.colors.inset} borderRadius="0" h="6px" borderWidth="1px" borderColor={ui.colors.border}>
          <Progress.Range bg={ui.colors.accent} borderRadius="0" />
        </Progress.Track>
      </Progress.Root>
    </Box>
  );
}

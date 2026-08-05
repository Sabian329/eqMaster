import { Box, Flex, Progress, Text } from '@chakra-ui/react';

interface MeasurementProgressProps {
  statusText: string;
  progress: number;
}

export function MeasurementProgress({ statusText, progress }: MeasurementProgressProps) {
  return (
    <Box>
      <Flex justify="space-between" fontSize="sm" color="gray.400" mb={2}>
        <Text color="gray.300">{statusText}</Text>
        <Text fontVariantNumeric="tabular-nums">{Math.round(progress)}%</Text>
      </Flex>
      <Progress.Root value={progress} size="sm">
        <Progress.Track bg="surface.inset" borderRadius="full" h="9px">
          <Progress.Range bg="brand.400" borderRadius="full" />
        </Progress.Track>
      </Progress.Root>
    </Box>
  );
}

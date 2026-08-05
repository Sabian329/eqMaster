import { Box, SimpleGrid, Stat } from '@chakra-ui/react';
import type { MeasurementMeta } from '../../types';
import { statLabelStyle, statValueStyle } from '../../theme';
import { CHART_STATS } from './constants';

interface ChartStatsGridProps {
  displayMeta: MeasurementMeta | null;
}

export function ChartStatsGrid({ displayMeta }: ChartStatsGridProps) {
  return (
    <SimpleGrid
      columns={{ base: 2, md: 4 }}
      gap={3}
      p={{ base: 4, md: 5 }}
      borderTopWidth="1px"
      borderColor="whiteAlpha.100"
    >
      {CHART_STATS.map(({ key, label, format }) => (
        <Box
          key={key}
          p={3}
          borderRadius="xl"
          borderWidth="1px"
          borderColor="whiteAlpha.100"
          bg="whiteAlpha.40"
          transition="border-color 0.15s ease"
          _hover={{ borderColor: 'whiteAlpha.200' }}
        >
          <Stat.Root size="sm">
            <Stat.Label {...statLabelStyle} mb={1}>
              {label}
            </Stat.Label>
            <Stat.ValueText {...statValueStyle} fontSize="md" fontVariantNumeric="tabular-nums">
              {displayMeta ? format(displayMeta) : '—'}
            </Stat.ValueText>
          </Stat.Root>
        </Box>
      ))}
    </SimpleGrid>
  );
}

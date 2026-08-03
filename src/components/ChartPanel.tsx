import {
  Box,
  Card,
  Flex,
  Heading,
  HStack,
  SimpleGrid,
  Stat,
  Text,
} from '@chakra-ui/react';
import type { RoomEqState } from '../hooks/useRoomEq';
import { formatDb } from '../utils/format';
import { panelStyles, statLabelStyle, statValueStyle } from '../theme';
import { FrequencyChart } from './FrequencyChart';

interface ChartPanelProps {
  state: RoomEqState;
}

const STATS = [
  { key: 'sampleRate', label: 'Sample rate', format: (m: NonNullable<RoomEqState['measurementMeta']>) => `${Math.round(m.sampleRate / 1000)} kHz` },
  { key: 'peakDb', label: 'Input peak', format: (m: NonNullable<RoomEqState['measurementMeta']>) => formatDb(m.peakDb) },
  { key: 'noiseDb', label: 'Pre-sweep noise', format: (m: NonNullable<RoomEqState['measurementMeta']>) => formatDb(m.noiseDb) },
  { key: 'samples', label: 'Samples', format: (m: NonNullable<RoomEqState['measurementMeta']>) => m.samples.toLocaleString('en-US') },
] as const;

export function ChartPanel({ state }: ChartPanelProps) {
  const { curve, measurementMeta } = state;

  return (
    <Card.Root {...panelStyles.root}>
      <Card.Header {...panelStyles.header}>
        <Flex justify="space-between" align="center" gap={4} flexWrap="wrap">
          <Heading size="md" fontWeight="semibold" color="gray.100">
            Frequency response
          </Heading>
          <HStack gap={4} fontSize="xs" color="gray.400">
            <HStack gap={2}>
              <Box w="18px" h="3px" borderRadius="sm" bg="brand.400" />
              <Text>measurement</Text>
            </HStack>
            <HStack gap={2}>
              <Box w="18px" h="3px" borderRadius="sm" bg="green.400" />
              <Text>target 0 dB</Text>
            </HStack>
          </HStack>
        </Flex>
      </Card.Header>

      <Box bg="chart.bg" minH={{ base: '430px', md: '520px' }} position="relative">
        <FrequencyChart
          curve={curve}
          fMin={measurementMeta?.fMin}
          fMax={measurementMeta?.fMax}
        />
      </Box>

      <SimpleGrid
        columns={{ base: 2, md: 4 }}
        gap={3}
        p={{ base: 4, md: 5 }}
        borderTopWidth="1px"
        borderColor="whiteAlpha.100"
      >
        {STATS.map(({ key, label, format }) => (
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
                {measurementMeta ? format(measurementMeta) : '—'}
              </Stat.ValueText>
            </Stat.Root>
          </Box>
        ))}
      </SimpleGrid>
    </Card.Root>
  );
}

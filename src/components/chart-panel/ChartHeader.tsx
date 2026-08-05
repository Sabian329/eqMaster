import { Box, Flex, Heading, HStack, Stack, Text } from '@chakra-ui/react';
import type { ChartSeries } from '../../types';

interface ChartHeaderProps {
  chartSeries: ChartSeries[];
}

export function ChartHeader({ chartSeries }: ChartHeaderProps) {
  const hasCorrected = chartSeries.some((item) => item.id === 'corrected');

  return (
    <Flex justify="space-between" align="flex-start" gap={4} flexWrap="wrap">
      <Stack gap={1} flex="1 1 240px">
        <Heading size="md" fontWeight="semibold" color="gray.100">
          Frequency response
        </Heading>
        {hasCorrected && (
          <Text fontSize="xs" color="gray.500" lineHeight="1.6" maxW="560px">
            Orange{' '}
            <Text as="span" color="#ff9f6b" fontWeight="semibold">
              After EQ
            </Text>{' '}
            previews the averaged curve with suggested filters and preamp applied — updates
            live when you change tone target, band count, preamp, or filter Q.
          </Text>
        )}
      </Stack>
      <HStack gap={4} fontSize="xs" color="gray.400" flexWrap="wrap">
        {chartSeries.map((item) => (
          <HStack key={item.id} gap={2}>
            {item.dash ? (
              <Box
                w="18px"
                h="0"
                borderTopWidth="2px"
                borderTopStyle="dashed"
                borderTopColor={item.color}
                opacity={item.alpha ?? 1}
              />
            ) : (
              <Box
                w="18px"
                h="3px"
                borderRadius="sm"
                bg={item.color}
                opacity={item.alpha ?? 1}
              />
            )}
            <Text>{item.label}</Text>
          </HStack>
        ))}
      </HStack>
    </Flex>
  );
}

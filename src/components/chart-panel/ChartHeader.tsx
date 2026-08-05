import { Box, Checkbox, Flex, Heading, HStack, Stack, Text } from '@chakra-ui/react';
import type { ChartSeries } from '../../types';

interface ChartHeaderProps {
  chartSeries: ChartSeries[];
  isChartSeriesVisible: (id: string) => boolean;
  onToggleChartSeries: (id: string) => void;
}

export function ChartHeader({
  chartSeries,
  isChartSeriesVisible,
  onToggleChartSeries,
}: ChartHeaderProps) {
  const hasCorrected = chartSeries.some((item) => item.id === 'corrected');
  const hasVerified = chartSeries.some((item) => item.id === 'verified');

  return (
    <Flex justify="space-between" align="flex-start" gap={4} flexWrap="wrap">
      <Stack gap={1} flex="1 1 240px">
        <Heading size="md" fontWeight="semibold" color="gray.100">
          Frequency response
        </Heading>
        {(hasCorrected || hasVerified) && (
          <Text fontSize="xs" color="gray.500" lineHeight="1.6" maxW="620px">
            {hasCorrected && (
              <>
                Orange{' '}
                <Text as="span" color="#ff9f6b" fontWeight="semibold">
                  After EQ
                </Text>{' '}
                is the predicted curve — updates live as you edit bands.{' '}
              </>
            )}
            {hasVerified && (
              <>
                Green{' '}
                <Text as="span" color="#55d68b" fontWeight="semibold">
                  Verified
                </Text>{' '}
                is a second measurement with EQ applied to the sweep.{' '}
              </>
            )}
            Click the chart to add custom bands.
          </Text>
        )}
      </Stack>
      <Stack gap={2} align="flex-start">
        <Text fontSize="2xs" color="gray.600" textTransform="uppercase" letterSpacing="0.06em">
          Show on chart
        </Text>
        <HStack gap={3} fontSize="xs" color="gray.400" flexWrap="wrap">
          {chartSeries.map((item) => {
            const visible = isChartSeriesVisible(item.id);
            return (
              <Checkbox.Root
                key={item.id}
                checked={visible}
                size="sm"
                onCheckedChange={() => onToggleChartSeries(item.id)}
              >
                <Checkbox.HiddenInput />
                <HStack gap={2} align="center">
                  <Checkbox.Control
                    borderColor="whiteAlpha.350"
                    bg="rgba(0,0,0,.25)"
                    _checked={{ bg: 'brand.400', borderColor: 'brand.400' }}
                  />
                  <Checkbox.Label
                    display="flex"
                    alignItems="center"
                    gap={2}
                    color={visible ? 'gray.300' : 'gray.600'}
                    opacity={visible ? 1 : 0.55}
                    cursor="pointer"
                    mb={0}
                  >
                    <SeriesSwatch item={item} dimmed={!visible} />
                    <Text>{item.label}</Text>
                  </Checkbox.Label>
                </HStack>
              </Checkbox.Root>
            );
          })}
        </HStack>
      </Stack>
    </Flex>
  );
}

function SeriesSwatch({ item, dimmed }: { item: ChartSeries; dimmed: boolean }) {
  const opacity = dimmed ? 0.35 : (item.alpha ?? 1);

  if (item.dash) {
    return (
      <Box
        w="18px"
        h="0"
        borderTopWidth="2px"
        borderTopStyle="dashed"
        borderTopColor={item.color}
        opacity={opacity}
      />
    );
  }

  return (
    <Box w="18px" h="3px" borderRadius="sm" bg={item.color} opacity={opacity} />
  );
}

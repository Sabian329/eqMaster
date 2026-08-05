import { Box, Checkbox, Flex, Heading, HStack, Stack, Text } from '@chakra-ui/react';
import type { ChartSeries } from '../../types';
import { FLAT_TARGET_LABEL } from '../../utils/toneProfile';

interface ChartHeaderProps {
  chartSeries: ChartSeries[];
  isChartSeriesVisible: (id: string) => boolean;
  onToggleChartSeries: (id: string) => void;
  showCorrectionFills: boolean;
  onToggleCorrectionFills: () => void;
  hasCorrectionFills: boolean;
}

export function ChartHeader({
  chartSeries,
  isChartSeriesVisible,
  onToggleChartSeries,
  showCorrectionFills,
  onToggleCorrectionFills,
  hasCorrectionFills,
}: ChartHeaderProps) {
  const hasCorrected = chartSeries.some((item) => item.id === 'corrected');
  const hasVerified = chartSeries.some((item) => item.id === 'verified');
  const hasTarget = chartSeries.some((item) => item.id === 'target');
  const toggleableSeries = chartSeries.filter((item) => item.id !== 'target');

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
        <HStack gap={3} fontSize="xs" flexWrap="wrap" align="center">
          {hasTarget ? (
            <HStack gap={2} align="center" px={0.5}>
              <Box
                w="18px"
                h="0"
                borderTopWidth="2px"
                borderTopStyle="dashed"
                borderTopColor="#f0f2f5"
              />
              <Text color="gray.50" fontWeight="medium" mb={0}>
                {FLAT_TARGET_LABEL}
              </Text>
            </HStack>
          ) : null}

          {toggleableSeries.map((item) => {
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

          {hasCorrectionFills ? (
            <Checkbox.Root
              checked={showCorrectionFills}
              size="sm"
              onCheckedChange={onToggleCorrectionFills}
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
                  color={showCorrectionFills ? 'gray.300' : 'gray.600'}
                  opacity={showCorrectionFills ? 1 : 0.55}
                  cursor="pointer"
                  mb={0}
                >
                  <CorrectionFillSwatch dimmed={!showCorrectionFills} />
                  <Text>Correction fills</Text>
                </Checkbox.Label>
              </HStack>
            </Checkbox.Root>
          ) : null}
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

function CorrectionFillSwatch({ dimmed }: { dimmed: boolean }) {
  return (
    <Box
      w="18px"
      h="10px"
      borderRadius="sm"
      opacity={dimmed ? 0.35 : 0.9}
      bg="linear-gradient(90deg, rgba(255,159,107,.55), rgba(85,214,139,.45), rgba(101,169,255,.45))"
      borderWidth="1px"
      borderColor="whiteAlpha.200"
    />
  );
}

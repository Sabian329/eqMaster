import { Box, Field, HStack, Input, NativeSelect, SimpleGrid, Text } from '@chakra-ui/react';
import type { RoomEqState } from '../../../hooks/useRoomEq';
import { fieldStyles, setupSectionStyles } from '../../../theme';
import { FormHelper, FormLabel } from '../../shared';
import { formatFrequency } from '../../../utils/format';
import { DURATION_OPTIONS, SMOOTHING_OPTIONS } from '../constants';

interface SweepSectionProps {
  state: RoomEqState;
}

export function SweepSection({ state }: SweepSectionProps) {
  const {
    fStart,
    setFStart,
    fEnd,
    setFEnd,
    duration,
    setDuration,
    smoothing,
    setSmoothing,
  } = state;

  return (
    <>
      <SimpleGrid {...setupSectionStyles.fieldGridWide}>
        <Field.Root>
          <FormLabel>Start frequency</FormLabel>
          <Input
            type="number"
            min={10}
            max={1000}
            step={1}
            value={fStart}
            {...fieldStyles.control}
            onChange={(e) => setFStart(Number(e.target.value))}
          />
          <FormHelper>Hz — low end of logarithmic sweep.</FormHelper>
        </Field.Root>
        <Field.Root>
          <FormLabel>End frequency</FormLabel>
          <Input
            type="number"
            min={1000}
            max={24000}
            step={100}
            value={fEnd}
            {...fieldStyles.control}
            onChange={(e) => setFEnd(Number(e.target.value))}
          />
          <FormHelper>Hz — upper limit (depends on speakers and mic).</FormHelper>
        </Field.Root>
        <Field.Root>
          <FormLabel>Sweep duration</FormLabel>
          <NativeSelect.Root size="md">
            <NativeSelect.Field
              {...fieldStyles.control}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </NativeSelect.Field>
          </NativeSelect.Root>
          <FormHelper>Longer sweeps improve SNR in reverberant rooms.</FormHelper>
        </Field.Root>
        <Field.Root>
          <FormLabel>Frequency smoothing</FormLabel>
          <NativeSelect.Root size="md">
            <NativeSelect.Field
              {...fieldStyles.control}
              value={smoothing}
              onChange={(e) => setSmoothing(Number(e.target.value))}
            >
              {SMOOTHING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </NativeSelect.Field>
          </NativeSelect.Root>
          <FormHelper>Resolution of the displayed and analyzed curve.</FormHelper>
        </Field.Root>
      </SimpleGrid>

      <Box {...setupSectionStyles.summaryStrip} mt={4}>
        <Text {...setupSectionStyles.summaryLabel}>Sweep preview</Text>
        <HStack gap={3} flexWrap="wrap" align="center">
          <Text fontSize="sm" fontWeight="semibold" color="brand.200" fontVariantNumeric="tabular-nums">
            {formatFrequency(fStart)}
          </Text>
          <Box flex={1} minW="120px" h="6px" borderRadius="full" bg="whiteAlpha.100" position="relative" overflow="hidden">
            <Box
              position="absolute"
              inset={0}
              borderRadius="full"
              bg="linear-gradient(90deg, rgba(255,140,66,.85), rgba(101,169,255,.85), rgba(167,139,250,.85))"
              opacity={0.75}
            />
          </Box>
          <Text fontSize="sm" fontWeight="semibold" color="brand.200" fontVariantNumeric="tabular-nums">
            {formatFrequency(fEnd)}
          </Text>
          <Text fontSize="xs" color="gray.500">
            · {duration}s · 1/{smoothing} oct
          </Text>
        </HStack>
      </Box>
    </>
  );
}

import { Field, Input, NativeSelect, SimpleGrid } from '@chakra-ui/react';
import type { RoomEqState } from '../../../hooks/useRoomEq';
import { fieldStyles } from '../../../theme';
import { FormLabel } from '../../shared';
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
    <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={4}>
      <Field.Root>
        <FormLabel>Start [Hz]</FormLabel>
        <Input
          type="number"
          min={10}
          max={1000}
          step={1}
          value={fStart}
          {...fieldStyles.control}
          onChange={(e) => setFStart(Number(e.target.value))}
        />
      </Field.Root>
      <Field.Root>
        <FormLabel>End [Hz]</FormLabel>
        <Input
          type="number"
          min={1000}
          max={24000}
          step={100}
          value={fEnd}
          {...fieldStyles.control}
          onChange={(e) => setFEnd(Number(e.target.value))}
        />
      </Field.Root>
      <Field.Root>
        <FormLabel>Sweep length</FormLabel>
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
      </Field.Root>
      <Field.Root>
        <FormLabel>Smoothing</FormLabel>
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
      </Field.Root>
    </SimpleGrid>
  );
}

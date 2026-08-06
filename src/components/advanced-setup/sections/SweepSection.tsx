import { Field, Input, NativeSelect, SimpleGrid } from '@chakra-ui/react';
import type { RoomEqState } from '../../../hooks/useRoomEq';
import { fieldStyles, setupSectionStyles } from '../../../theme';
import { FormHelper, FormLabel } from '../../shared';
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
          <FormHelper>
            Resolution of the displayed and analyzed curve. Best results: 1/12
            octave for algorithm V2 / V3. RAW skips smoothing (not recommended).
          </FormHelper>
        </Field.Root>
      </SimpleGrid>
    </>
  );
}

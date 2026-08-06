import {
  Field,
  Input,
  NativeSelect,
  Stack,
} from '@chakra-ui/react';
import {
  MEASUREMENT_NAME_PREFIX_OPTIONS,
  type MeasurementNamePrefixId,
} from '../../config/measurementNamePrefixes';
import { fieldStyles } from '../../theme';
import { FormHelper, FormLabel } from './FormField';

export interface MeasurementNameFieldsProps {
  prefixId: MeasurementNamePrefixId;
  onPrefixIdChange: (id: MeasurementNamePrefixId) => void;
  customPrefix: string;
  onCustomPrefixChange: (value: string) => void;
  name: string;
  onNameChange: (value: string) => void;
  helperText?: string;
}

export function MeasurementNameFields({
  prefixId,
  onPrefixIdChange,
  customPrefix,
  onCustomPrefixChange,
  name,
  onNameChange,
  helperText = 'Shown on the saved measurements list above Frequency response.',
}: MeasurementNameFieldsProps) {
  return (
    <Stack gap={3}>
      <Field.Root>
        <FormLabel>Name prefix</FormLabel>
        <NativeSelect.Root size="md">
          <NativeSelect.Field
            {...fieldStyles.control}
            value={prefixId}
            onChange={(e) =>
              onPrefixIdChange(e.target.value as MeasurementNamePrefixId)
            }
          >
            {MEASUREMENT_NAME_PREFIX_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </NativeSelect.Field>
        </NativeSelect.Root>
        <FormHelper>Suggested labels for the saved measurement name.</FormHelper>
      </Field.Root>

      {prefixId === 'custom' ? (
        <Field.Root>
          <FormLabel>Custom prefix</FormLabel>
          <Input
            value={customPrefix}
            maxLength={40}
            placeholder="e.g. Bedroom L, Nearfield…"
            {...fieldStyles.control}
            onChange={(e) => onCustomPrefixChange(e.target.value)}
          />
        </Field.Root>
      ) : null}

      <Field.Root>
        <FormLabel>Full name</FormLabel>
        <Input
          value={name}
          maxLength={100}
          {...fieldStyles.control}
          onChange={(e) => onNameChange(e.target.value)}
        />
        <FormHelper>{helperText}</FormHelper>
      </Field.Root>
    </Stack>
  );
}

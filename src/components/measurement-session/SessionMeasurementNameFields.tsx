import { Field, Input, NativeSelect, Stack, Text } from '@chakra-ui/react';
import {
  MEASUREMENT_NAME_TAGS,
  type MeasurementNameTagId,
} from '../../config/measurementNameTags';
import { fieldStyles, ui } from '../../theme';
import { FormHelper, FormLabel } from '../shared';

interface SessionMeasurementNameFieldsProps {
  tagId: MeasurementNameTagId;
  customLabel: string;
  onTagChange: (tagId: MeasurementNameTagId) => void;
  onCustomLabelChange: (value: string) => void;
  previewName: string;
}

export function SessionMeasurementNameFields({
  tagId,
  customLabel,
  onTagChange,
  onCustomLabelChange,
  previewName,
}: SessionMeasurementNameFieldsProps) {
  return (
    <Stack
      gap={2}
      p={3}
      borderWidth="1px"
      borderColor={ui.colors.border}
      borderRadius={ui.radius.sm}
      bg={ui.colors.inset}
    >
      <Text
        fontSize="2xs"
        color={ui.colors.textDim}
        textTransform="uppercase"
        letterSpacing="0.08em"
        fontFamily={ui.fonts.mono}
      >
        Save as
      </Text>
      <Field.Root>
        <FormLabel>Measurement name</FormLabel>
        <NativeSelect.Root size="md">
          <NativeSelect.Field
            {...fieldStyles.control}
            value={tagId}
            onChange={(event) =>
              onTagChange(event.target.value as MeasurementNameTagId)
            }
          >
            {MEASUREMENT_NAME_TAGS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </NativeSelect.Field>
        </NativeSelect.Root>
        <FormHelper>
          Prefix for the saved measurement (and preset name).
        </FormHelper>
      </Field.Root>
      {tagId === 'custom' ? (
        <Field.Root>
          <FormLabel>Custom prefix</FormLabel>
          <Input
            value={customLabel}
            maxLength={40}
            placeholder="e.g. Left speaker, Bedroom…"
            {...fieldStyles.control}
            onChange={(event) => onCustomLabelChange(event.target.value)}
          />
        </Field.Root>
      ) : null}
      <Text fontSize="xs" color={ui.colors.textMuted} fontFamily={ui.fonts.mono} lineClamp={2}>
        {previewName}
      </Text>
    </Stack>
  );
}

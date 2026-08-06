import { useMemo, useState } from 'react';
import {
  Button,
  Dialog,
  Field,
  Input,
  NativeSelect,
  Stack,
  Text,
} from '@chakra-ui/react';
import {
  MEASUREMENT_NAME_TAGS,
  resolveMeasurementNameLabel,
  type MeasurementNameTagId,
} from '../../config/measurementNameTags';
import {
  MOCK_PRESET_COUNT,
  getMockPresetDescription,
  getMockPresetLabel,
} from '../advanced-setup/constants';
import { buttonStyles, fieldStyles, modalStyles, ui } from '../../theme';
import { FormHelper, FormLabel } from '../shared';

export interface GenerateMockMeasurementOptions {
  presetId: number;
  label: string;
}

interface GenerateMockMeasurementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (options: GenerateMockMeasurementOptions) => void;
}

export function GenerateMockMeasurementDialog({
  open,
  onOpenChange,
  onGenerate,
}: GenerateMockMeasurementDialogProps) {
  const [tagId, setTagId] = useState<MeasurementNameTagId>('room');
  const [customLabel, setCustomLabel] = useState('');
  const [presetId, setPresetId] = useState(9);

  const nameLabel = useMemo(
    () => resolveMeasurementNameLabel(tagId, customLabel),
    [customLabel, tagId],
  );
  const complexityLabel = getMockPresetLabel(presetId);
  const complexityDescription = getMockPresetDescription(presetId);
  const combinedLabel = `${nameLabel} · ${complexityLabel}`;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(details) => onOpenChange(details.open)}
      placement="center"
    >
      <Dialog.Backdrop {...modalStyles.backdrop} />
      <Dialog.Positioner {...modalStyles.positioner}>
        <Dialog.Content
          {...modalStyles.content}
          h="auto"
          maxH="90vh"
          maxW="440px"
        >
          <Dialog.Header {...modalStyles.header}>
            <Dialog.Title {...modalStyles.title}>
              Generate mock measurement
            </Dialog.Title>
          </Dialog.Header>

          <Dialog.Body {...modalStyles.bodyScroll}>
            <Stack gap={4} p={1}>
              <Text fontSize="xs" color={ui.colors.textMuted} lineHeight="1.55">
                Create a synthetic curve and add it to the saved measurements
                list. Useful for testing Auto EQ without a live sweep.
              </Text>

              <Field.Root>
                <FormLabel>Name</FormLabel>
                <NativeSelect.Root size="md">
                  <NativeSelect.Field
                    {...fieldStyles.control}
                    value={tagId}
                    onChange={(event) =>
                      setTagId(event.target.value as MeasurementNameTagId)
                    }
                  >
                    {MEASUREMENT_NAME_TAGS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </NativeSelect.Field>
                </NativeSelect.Root>
                <FormHelper>Prefix stored with the saved measurement.</FormHelper>
              </Field.Root>

              {tagId === 'custom' ? (
                <Field.Root>
                  <FormLabel>Custom prefix</FormLabel>
                  <Input
                    value={customLabel}
                    maxLength={40}
                    placeholder="e.g. Left speaker…"
                    {...fieldStyles.control}
                    onChange={(event) => setCustomLabel(event.target.value)}
                  />
                </Field.Root>
              ) : null}

              <Field.Root>
                <FormLabel>Complexity</FormLabel>
                <NativeSelect.Root size="md">
                  <NativeSelect.Field
                    {...fieldStyles.control}
                    value={presetId}
                    onChange={(event) => setPresetId(Number(event.target.value))}
                  >
                    {Array.from({ length: MOCK_PRESET_COUNT }, (_, index) => {
                      const id = index + 1;
                      return (
                        <option key={id} value={id}>
                          {getMockPresetLabel(id)}
                        </option>
                      );
                    })}
                  </NativeSelect.Field>
                </NativeSelect.Root>
                <FormHelper>
                  {complexityDescription ??
                    'Basic room response with mild modal colouration.'}
                </FormHelper>
              </Field.Root>

              <Text
                fontSize="xs"
                color={ui.colors.textMuted}
                fontFamily={ui.fonts.mono}
                lineClamp={2}
              >
                Will save as: {combinedLabel} · …
              </Text>
            </Stack>
          </Dialog.Body>

          <Dialog.Footer {...modalStyles.footer}>
            <Button
              {...buttonStyles.secondary}
              {...modalStyles.actionButton}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              {...buttonStyles.primary}
              {...modalStyles.actionButton}
              onClick={() => {
                onGenerate({ presetId, label: combinedLabel });
                onOpenChange(false);
              }}
            >
              Generate
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

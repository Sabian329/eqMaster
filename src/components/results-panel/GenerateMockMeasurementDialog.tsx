import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Dialog,
  Grid,
  Stack,
  Text,
} from '@chakra-ui/react';
import {
  MOCK_PRESET_COUNT,
  getMockPresetDescription,
  getMockPresetLabel,
} from '../advanced-setup/constants';
import {
  joinMeasurementNameParts,
  resolveMeasurementNamePrefix,
  type MeasurementNamePrefixId,
} from '../../config/measurementNamePrefixes';
import { formatLocalDateTime } from '../../utils/savedMeasurements';
import { buttonStyles, fieldStyles, modalStyles, ui } from '../../theme';
import { MeasurementNameFields } from '../shared';

export interface GenerateMockMeasurementDialogProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (options: {
    name: string;
    presetId: number;
    prefix?: string;
  }) => void;
}

function composeMockName(
  prefix: string,
  presetId: number,
  when = new Date(),
): string {
  return joinMeasurementNameParts(
    prefix,
    getMockPresetLabel(presetId),
    formatLocalDateTime(when),
  );
}

export function GenerateMockMeasurementDialog({
  open,
  onClose,
  onGenerate,
}: GenerateMockMeasurementDialogProps) {
  const [presetId, setPresetId] = useState(1);
  const [prefixId, setPrefixId] = useState<MeasurementNamePrefixId>('room');
  const [customPrefix, setCustomPrefix] = useState('');
  const [name, setName] = useState(() => composeMockName('Room', 1));
  const [nameTouched, setNameTouched] = useState(false);

  const prefixLabel = useMemo(
    () => resolveMeasurementNamePrefix(prefixId, customPrefix),
    [prefixId, customPrefix],
  );

  useEffect(() => {
    if (!open) return;
    setPresetId(1);
    setPrefixId('room');
    setCustomPrefix('');
    setName(composeMockName('Room', 1));
    setNameTouched(false);
  }, [open]);

  useEffect(() => {
    if (!open || nameTouched) return;
    setName(composeMockName(prefixLabel, presetId));
  }, [open, nameTouched, prefixLabel, presetId]);

  const description = getMockPresetDescription(presetId);

  const handleGenerate = () => {
    onGenerate({ name, presetId, prefix: prefixLabel });
    onClose();
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
      placement="center"
    >
      <Dialog.Backdrop {...modalStyles.backdrop} />
      <Dialog.Positioner {...modalStyles.positioner}>
        <Dialog.Content
          {...modalStyles.content}
          h="auto"
          maxH="90vh"
          maxW="560px"
        >
          <Dialog.Header {...modalStyles.header}>
            <Dialog.Title {...modalStyles.title}>
              Generate mock measurement
            </Dialog.Title>
            <Text {...modalStyles.subtitle} mt={1}>
              Pick a name prefix and complexity — result is saved to the
              measurement library.
            </Text>
          </Dialog.Header>

          <Dialog.Body {...modalStyles.body} overflowY="auto">
            <Stack gap={4}>
              <MeasurementNameFields
                prefixId={prefixId}
                onPrefixIdChange={(id) => {
                  setNameTouched(false);
                  setPrefixId(id);
                }}
                customPrefix={customPrefix}
                onCustomPrefixChange={(value) => {
                  setNameTouched(false);
                  setCustomPrefix(value);
                }}
                name={name}
                onNameChange={(value) => {
                  setNameTouched(true);
                  setName(value);
                }}
                helperText="Auto-built from prefix · complexity · date — edit freely if needed."
              />

              <Stack gap={2}>
                <Text {...fieldStyles.label} mb={0}>
                  Complexity
                </Text>
                <Grid templateColumns="repeat(3, minmax(0, 1fr))" gap={2}>
                  {Array.from({ length: MOCK_PRESET_COUNT }, (_, index) => {
                    const id = index + 1;
                    const selected = presetId === id;
                    return (
                      <Button
                        key={id}
                        size="sm"
                        h="32px"
                        borderRadius="2px"
                        {...(selected
                          ? buttonStyles.primary
                          : buttonStyles.secondary)}
                        onClick={() => {
                          setNameTouched(false);
                          setPresetId(id);
                        }}
                      >
                        {getMockPresetLabel(id)}
                      </Button>
                    );
                  })}
                </Grid>
                <Text fontSize="2xs" color={ui.colors.textMuted} lineHeight="1.55">
                  {description ??
                    'Milder synthetic rooms (1–4) — good for first EQ checks.'}
                </Text>
              </Stack>
            </Stack>
          </Dialog.Body>

          <Dialog.Footer {...modalStyles.footer}>
            <Button
              size="sm"
              borderRadius="2px"
              {...buttonStyles.secondary}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              borderRadius="2px"
              {...buttonStyles.primary}
              onClick={handleGenerate}
              disabled={!name.trim()}
            >
              Generate
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

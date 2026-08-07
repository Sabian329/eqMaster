import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  Field,
  Input,
  Stack,
  Text,
} from '@chakra-ui/react';
import { buttonStyles, fieldStyles, modalStyles } from '../../theme';
import { FormHelper, FormLabel } from '../shared';

export interface SavePresetDialogProps {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (name: string) => void;
}

export function SavePresetDialog({
  open,
  initialName,
  onClose,
  onSave,
}: SavePresetDialogProps) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
  }, [open, initialName]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
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
          maxW="420px"
          maxH="90vh"
        >
          <Dialog.Header {...modalStyles.header}>
            <Dialog.Title {...modalStyles.title}>Save preset</Dialog.Title>
            <Text {...modalStyles.subtitle} mt={1}>
              Edit the name before adding this EQ preset to the library.
            </Text>
          </Dialog.Header>

          <Dialog.Body {...modalStyles.body}>
            <Stack gap={3}>
              <Field.Root>
                <FormLabel>Preset name</FormLabel>
                <Input
                  value={name}
                  maxLength={100}
                  autoFocus
                  {...fieldStyles.control}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                  }}
                />
                <FormHelper>
                  Shown on the saved presets list. Persists after restart.
                </FormHelper>
              </Field.Root>
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
              onClick={handleSave}
              disabled={!name.trim()}
            >
              Save preset
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

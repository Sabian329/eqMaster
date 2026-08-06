import { Button, Dialog, Text } from '@chakra-ui/react';
import { buttonStyles, modalStyles, ui } from '../../theme';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(details) => {
        if (!details.open) onCancel();
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
            <Dialog.Title {...modalStyles.title}>{title}</Dialog.Title>
          </Dialog.Header>

          <Dialog.Body {...modalStyles.body}>
            <Text
              fontSize="sm"
              color={ui.colors.textMuted}
              lineHeight="1.6"
              whiteSpace="pre-wrap"
            >
              {description}
            </Text>
          </Dialog.Body>

          <Dialog.Footer {...modalStyles.footer}>
            <Button
              size="sm"
              borderRadius="2px"
              {...buttonStyles.secondary}
              onClick={onCancel}
            >
              {cancelLabel}
            </Button>
            <Button
              size="sm"
              borderRadius="2px"
              {...(tone === 'danger' ? buttonStyles.danger : buttonStyles.primary)}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

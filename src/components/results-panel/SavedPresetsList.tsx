import { useState } from 'react';
import { Badge, Button, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import type { RoomEqState } from '../../hooks/useRoomEq';
import type { SavedPreset } from '../../types';
import { badgeStyles, buttonStyles, ui } from '../../theme';
import { ConfirmDialog } from '../shared';
import { SavePresetDialog } from './SavePresetDialog';

interface SavedPresetsListProps {
  state: RoomEqState;
}

export function SavedPresetsList({ state }: SavedPresetsListProps) {
  const {
    savedPresets,
    activeSavedPresetId,
    savePreset,
    loadSavedPreset,
    deleteSavedPreset,
    presetName,
    suggestions,
    curve,
  } = state;
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SavedPreset | null>(null);

  const canSave = curve.length > 0 && suggestions.length > 0;

  return (
    <>
      <Stack
        gap={2}
        pb={3}
        mb={4}
        borderBottomWidth="1px"
        borderColor={ui.colors.border}
      >
        <Flex justify="space-between" align="center" gap={3} flexWrap="wrap">
          <Text
            fontSize="2xs"
            fontWeight="700"
            color={ui.colors.textDim}
            letterSpacing="0.08em"
            textTransform="uppercase"
            fontFamily={ui.fonts.mono}
          >
            Saved presets
          </Text>
          <Button
            size="xs"
            h="24px"
            px={2}
            borderRadius="2px"
            {...buttonStyles.secondary}
            fontSize="2xs"
            disabled={!canSave}
            onClick={() => setSaveDialogOpen(true)}
          >
            Save preset
          </Button>
        </Flex>

        {savedPresets.length ? (
          <Stack gap={1.5} maxH="140px" overflowY="auto">
            {savedPresets.map((item) => {
              const isActive = item.id === activeSavedPresetId;
              return (
                <Flex
                  key={item.id}
                  align="center"
                  justify="space-between"
                  gap={2}
                  flexWrap="wrap"
                  px={2}
                  py={1.5}
                  bg={isActive ? 'rgba(82,209,182,.08)' : ui.colors.inset}
                  borderWidth="1px"
                  borderColor={
                    isActive ? ui.colors.accentMuted : ui.colors.border
                  }
                  borderRadius={ui.radius.sm}
                >
                  <Badge
                    {...badgeStyles.info}
                    color={isActive ? ui.colors.accent : ui.colors.textMuted}
                    borderColor={
                      isActive ? ui.colors.accentMuted : ui.colors.borderStrong
                    }
                    textTransform="none"
                    letterSpacing="0.02em"
                    fontWeight="600"
                    maxW={{ base: '100%', md: '420px' }}
                    whiteSpace="normal"
                    lineHeight="1.35"
                  >
                    {item.name}
                  </Badge>
                  <HStack gap={1.5}>
                    <Button
                      size="xs"
                      h="24px"
                      px={2}
                      borderRadius="2px"
                      {...buttonStyles.secondary}
                      fontSize="2xs"
                      onClick={() => loadSavedPreset(item.id)}
                      disabled={isActive}
                    >
                      Load
                    </Button>
                    <Button
                      size="xs"
                      h="24px"
                      px={2}
                      borderRadius="2px"
                      {...buttonStyles.danger}
                      fontSize="2xs"
                      onClick={() => setPendingDelete(item)}
                    >
                      Delete
                    </Button>
                  </HStack>
                </Flex>
              );
            })}
          </Stack>
        ) : (
          <Text fontSize="2xs" color={ui.colors.textDim} lineHeight="1.5">
            Save an EQ preset to keep filter settings here (persists after
            restart).
          </Text>
        )}
      </Stack>

      <SavePresetDialog
        open={saveDialogOpen}
        initialName={presetName}
        onClose={() => setSaveDialogOpen(false)}
        onSave={savePreset}
      />

      <ConfirmDialog
        open={pendingDelete != null}
        title="Delete preset"
        description={
          pendingDelete
            ? `Remove this saved preset from the library?\n\n${pendingDelete.name}`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            deleteSavedPreset(pendingDelete.id);
          }
          setPendingDelete(null);
        }}
      />
    </>
  );
}

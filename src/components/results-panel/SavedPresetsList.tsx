import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  Flex,
  HStack,
  Stack,
  Text,
} from '@chakra-ui/react';
import type { RoomEqState } from '../../hooks/useRoomEq';
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
    deleteSavedPresets,
    presetName,
    suggestions,
    curve,
  } = state;
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(
    null,
  );

  const canSave = curve.length > 0 && suggestions.length > 0;

  const presetIds = useMemo(
    () => savedPresets.map((item) => item.id),
    [savedPresets],
  );

  useEffect(() => {
    setSelectedIds((previous) =>
      previous.filter((id) => presetIds.includes(id)),
    );
  }, [presetIds]);

  const selectedCount = selectedIds.length;
  const allSelected =
    savedPresets.length > 0 && selectedCount === savedPresets.length;

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((previous) => {
      if (checked) {
        return previous.includes(id) ? previous : [...previous, id];
      }
      return previous.filter((item) => item !== id);
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? [...presetIds] : []);
  };

  const pendingNames = pendingDeleteIds
    ? savedPresets
        .filter((item) => pendingDeleteIds.includes(item.id))
        .map((item) => item.name)
    : [];

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
          <HStack gap={1.5} flexWrap="wrap">
            {savedPresets.length > 0 ? (
              <Button
                size="xs"
                h="24px"
                px={2}
                borderRadius="2px"
                {...buttonStyles.danger}
                fontSize="2xs"
                disabled={selectedCount === 0}
                onClick={() => setPendingDeleteIds([...selectedIds])}
              >
                Delete selected{selectedCount > 0 ? ` (${selectedCount})` : ''}
              </Button>
            ) : null}
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
          </HStack>
        </Flex>

        {savedPresets.length ? (
          <Stack gap={1.5}>
            <Checkbox.Root
              checked={allSelected}
              size="sm"
              onCheckedChange={(details) =>
                toggleSelectAll(details.checked === true)
              }
            >
              <Checkbox.HiddenInput />
              <HStack gap={2} align="center">
                <Checkbox.Control
                  borderColor={ui.colors.borderStrong}
                  borderRadius="2px"
                  bg={ui.colors.inset}
                  _checked={{
                    bg: ui.colors.accent,
                    borderColor: ui.colors.accent,
                  }}
                />
                <Checkbox.Label
                  fontSize="2xs"
                  color={ui.colors.textDim}
                  cursor="pointer"
                  mb={0}
                >
                  Select all
                </Checkbox.Label>
              </HStack>
            </Checkbox.Root>

            <Stack gap={1.5} maxH="280px" overflowY="auto">
              {savedPresets.map((item) => {
                const isActive = item.id === activeSavedPresetId;
                const isSelected = selectedIds.includes(item.id);
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
                    <HStack gap={2} align="center" flex="1 1 220px" minW={0}>
                      <Checkbox.Root
                        checked={isSelected}
                        size="sm"
                        flexShrink={0}
                        onCheckedChange={(details) =>
                          toggleSelected(item.id, details.checked === true)
                        }
                      >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control
                          borderColor={ui.colors.borderStrong}
                          borderRadius="2px"
                          bg={ui.colors.inset}
                          _checked={{
                            bg: ui.colors.accent,
                            borderColor: ui.colors.accent,
                          }}
                        />
                      </Checkbox.Root>
                      <Badge
                        {...badgeStyles.info}
                        color={
                          isActive ? ui.colors.accent : ui.colors.textMuted
                        }
                        borderColor={
                          isActive
                            ? ui.colors.accentMuted
                            : ui.colors.borderStrong
                        }
                        textTransform="none"
                        letterSpacing="0.02em"
                        fontWeight="600"
                        maxW="100%"
                        whiteSpace="normal"
                        lineHeight="1.35"
                      >
                        {item.name}
                      </Badge>
                    </HStack>
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
                        onClick={() => setPendingDeleteIds([item.id])}
                      >
                        Delete
                      </Button>
                    </HStack>
                  </Flex>
                );
              })}
            </Stack>
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
        open={pendingDeleteIds != null}
        title={
          pendingDeleteIds && pendingDeleteIds.length > 1
            ? 'Delete presets'
            : 'Delete preset'
        }
        description={
          pendingDeleteIds
            ? pendingDeleteIds.length > 1
              ? `Remove ${pendingDeleteIds.length} saved presets from the library?\n\n${pendingNames.join('\n')}`
              : `Remove this saved preset from the library?\n\n${pendingNames[0] ?? ''}`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        onCancel={() => setPendingDeleteIds(null)}
        onConfirm={() => {
          if (!pendingDeleteIds?.length) {
            setPendingDeleteIds(null);
            return;
          }
          if (pendingDeleteIds.length === 1) {
            deleteSavedPreset(pendingDeleteIds[0]);
          } else {
            deleteSavedPresets(pendingDeleteIds);
          }
          setSelectedIds((previous) =>
            previous.filter((id) => !pendingDeleteIds.includes(id)),
          );
          setPendingDeleteIds(null);
        }}
      />
    </>
  );
}

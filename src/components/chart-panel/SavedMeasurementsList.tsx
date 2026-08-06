import { useState } from 'react';
import { Badge, Button, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import type { RoomEqState } from '../../hooks/useRoomEq';
import type { SavedMeasurement } from '../../types';
import { badgeStyles, buttonStyles, ui } from '../../theme';
import { ConfirmDialog } from '../shared';
import { GenerateMockMeasurementDialog } from '../results-panel/GenerateMockMeasurementDialog';

interface SavedMeasurementsListProps {
  state: RoomEqState;
}

export function SavedMeasurementsList({ state }: SavedMeasurementsListProps) {
  const {
    savedMeasurements,
    activeSavedMeasurementId,
    loadSavedMeasurement,
    deleteSavedMeasurement,
    generateMockMeasurement,
  } = state;
  const [mockDialogOpen, setMockDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SavedMeasurement | null>(
    null,
  );

  return (
    <>
      <Stack
        gap={2}
        pb={3}
        mb={3}
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
            Saved measurements
          </Text>
          <Button
            size="xs"
            h="24px"
            px={2}
            fontSize="2xs"
            borderRadius="2px"
            {...buttonStyles.secondary}
            onClick={() => setMockDialogOpen(true)}
          >
            Generate mock
          </Button>
        </Flex>

        {savedMeasurements.length ? (
          <Stack gap={1.5} maxH="140px" overflowY="auto">
            {savedMeasurements.map((item) => {
              const isActive = item.id === activeSavedMeasurementId;
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
                      fontSize="2xs"
                      borderRadius="2px"
                      {...buttonStyles.secondary}
                      onClick={() => loadSavedMeasurement(item.id)}
                      disabled={isActive}
                    >
                      Load
                    </Button>
                    <Button
                      size="xs"
                      h="24px"
                      px={2}
                      fontSize="2xs"
                      borderRadius="2px"
                      {...buttonStyles.danger}
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
            Finish a session or generate a mock to keep measurements here
            (persists after restart).
          </Text>
        )}
      </Stack>

      <GenerateMockMeasurementDialog
        open={mockDialogOpen}
        onClose={() => setMockDialogOpen(false)}
        onGenerate={generateMockMeasurement}
      />

      <ConfirmDialog
        open={pendingDelete != null}
        title="Delete measurement"
        description={
          pendingDelete
            ? `Remove this saved measurement from the library?\n\n${pendingDelete.name}`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            deleteSavedMeasurement(pendingDelete.id);
          }
          setPendingDelete(null);
        }}
      />
    </>
  );
}

import { useState } from "react";
import { Box, Button, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import type { SavedMeasurement } from "../../types/savedMeasurement";
import { buttonStyles, ui } from "../../theme";
import {
	GenerateMockMeasurementDialog,
	type GenerateMockMeasurementOptions,
} from "./GenerateMockMeasurementDialog";

interface ChartSavedMeasurementsProps {
	items: SavedMeasurement[];
	activeId: string | null;
	onSelect: (id: string) => void;
	onDelete: (id: string) => void;
	onGenerateMock: (options: GenerateMockMeasurementOptions) => void;
}

export function ChartSavedMeasurements({
	items,
	activeId,
	onSelect,
	onDelete,
	onGenerateMock,
}: ChartSavedMeasurementsProps) {
	const [mockDialogOpen, setMockDialogOpen] = useState(false);

	return (
		<Stack
			gap={2}
			mb={3}
			pb={3}
			borderBottomWidth="1px"
			borderColor={ui.colors.border}
		>
			<Flex justify="space-between" align="center" gap={3} flexWrap="wrap">
				<Text
					fontSize="2xs"
					color={ui.colors.textDim}
					textTransform="uppercase"
					letterSpacing="0.08em"
					fontFamily={ui.fonts.mono}
				>
					Saved measurements
				</Text>
				<HStack gap={2}>
					<Text
						fontSize="2xs"
						color={ui.colors.textDim}
						fontFamily={ui.fonts.mono}
					>
						{items.length === 0 ? "None yet" : `${items.length} saved`}
					</Text>
					<Button
						size="xs"
						h="26px"
						px={2.5}
						borderRadius="2px"
						{...buttonStyles.secondary}
						onClick={() => setMockDialogOpen(true)}
					>
						Generate mock measurement
					</Button>
				</HStack>
			</Flex>

			{items.length === 0 ? (
				<Text fontSize="xs" color={ui.colors.textMuted} lineHeight="1.5">
					Finish a live session or generate a mock measurement. Entries persist
					after restart (web + desktop).
				</Text>
			) : (
				<Box
					maxH="112px"
					overflowY="auto"
					borderWidth="1px"
					borderColor={ui.colors.border}
					borderRadius={ui.radius.sm}
					bg={ui.colors.inset}
				>
					<Stack gap={0}>
						{items.map((item) => {
							const active = item.id === activeId;
							return (
								<Flex
									key={item.id}
									align="center"
									justify="space-between"
									gap={2}
									px={2.5}
									py={1.5}
									borderBottomWidth="1px"
									borderColor={ui.colors.border}
									bg={active ? "rgba(82, 209, 182, 0.12)" : "transparent"}
									_hover={{
										bg: active
											? "rgba(82, 209, 182, 0.16)"
											: ui.colors.panelRaised,
									}}
								>
									<Button
										variant="ghost"
										justifyContent="flex-start"
										flex="1"
										minW={0}
										h="auto"
										px={1}
										py={0.5}
										borderRadius="2px"
										onClick={() => onSelect(item.id)}
										title={item.name}
									>
										<Text
											fontSize="xs"
											fontFamily={ui.fonts.mono}
											color={active ? ui.colors.accent : ui.colors.text}
											fontWeight={active ? "700" : "500"}
											textAlign="left"
											lineClamp={1}
										>
											{item.name}
										</Text>
									</Button>
									<HStack gap={1} flexShrink={0}>
										{item.runs.length > 1 ? (
											<Text
												fontSize="2xs"
												color={ui.colors.textDim}
												fontFamily={ui.fonts.mono}
											>
												×{item.runs.length}
											</Text>
										) : null}
										<Button
											size="xs"
											h="24px"
											minW="24px"
											px={2}
											borderRadius="2px"
											{...buttonStyles.secondary}
											aria-label={`Delete ${item.name}`}
											onClick={(event) => {
												event.stopPropagation();
												onDelete(item.id);
											}}
										>
											×
										</Button>
									</HStack>
								</Flex>
							);
						})}
					</Stack>
				</Box>
			)}

			<GenerateMockMeasurementDialog
				open={mockDialogOpen}
				onOpenChange={setMockDialogOpen}
				onGenerate={onGenerateMock}
			/>
		</Stack>
	);
}

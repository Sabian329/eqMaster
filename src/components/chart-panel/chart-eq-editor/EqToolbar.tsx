import {
	Box,
	Button,
	Field,
	Flex,
	Grid,
	HStack,
	Input,
	Stack,
	Text,
} from "@chakra-ui/react";
import type { RoomEqState } from "../../../hooks/useRoomEq";
import { EQ_SHAPE_PRESETS } from "../../../config/eqShapePresets";
import { buttonStyles, fieldStyles, ui } from "../../../theme";
import { MeasurementProgress } from "../../shared";

interface EqToolbarProps {
	state: Pick<
		RoomEqState,
		| "eqShapePreset"
		| "applyEqShapePreset"
		| "sosOverlayEnabled"
		| "toggleSosOverlay"
		| "presetPreamp"
		| "setPresetPreamp"
		| "curve"
		| "verificationCurve"
		| "verificationMeta"
		| "verificationRunning"
		| "verifyEnabled"
		| "statusText"
		| "progress"
		| "runVerificationMeasurement"
		| "clearVerification"
	>;
}

const toolbarLabelRow = {
	minH: "18px",
	mb: 1.5,
	align: "center" as const,
	justify: "space-between" as const,
};

const controlRowMinH = "34px";

export function EqToolbar({ state }: EqToolbarProps) {
	const {
		eqShapePreset,
		applyEqShapePreset,
		sosOverlayEnabled,
		toggleSosOverlay,
		presetPreamp,
		setPresetPreamp,
		curve,
		verificationCurve,
		verificationMeta,
		verificationRunning,
		verifyEnabled,
		runVerificationMeasurement,
		clearVerification,
		statusText,
		progress,
	} = state;

	const hasVerification = Boolean(verificationCurve?.length);
	const showVerifyControls = curve.length > 0;

	return (
		<Box
			borderBottomWidth="1px"
			borderColor={ui.colors.border}
			bg={ui.colors.panelRaised}
		>
			<Grid
				px={{ base: 3, md: 4 }}
				py={3}
				gap={{ base: 3, lg: 4 }}
				alignItems="end"
				templateColumns={{
					base: "1fr",
					lg: "minmax(0, 1.35fr) minmax(0, 1fr) auto",
				}}
			>
				<Field.Root minW={0}>
					<Flex {...toolbarLabelRow}>
						<Field.Label {...fieldStyles.label} mb={0} fontSize="2xs">
							EQ shape
						</Field.Label>
						<Box />
					</Flex>
					<Stack
						gap={2}
						minH={controlRowMinH}
						justify="center"
						direction={{ base: "column", lg: "row" }}
						align={{ lg: "center" }}
					>
						<Grid
							templateColumns="repeat(4, minmax(0, 1fr))"
							gap={2}
							w={{ base: "full", lg: "auto" }}
						>
							{EQ_SHAPE_PRESETS.map((preset) => (
								<Button
									key={preset.id}
									size="sm"
									h="32px"
									borderRadius="2px"
									{...(eqShapePreset === preset.id
										? buttonStyles.primary
										: buttonStyles.secondary)}
									onClick={() => applyEqShapePreset(preset.id)}
								>
									{preset.label}
								</Button>
							))}
							<Button
								size="sm"
								h="32px"
								borderRadius="2px"
								aria-pressed={sosOverlayEnabled}
								{...(sosOverlayEnabled
									? buttonStyles.primary
									: buttonStyles.secondary)}
								onClick={toggleSosOverlay}
							>
								SOS
							</Button>
						</Grid>
					</Stack>
				</Field.Root>

				<Field.Root minW={0}>
					<Flex {...toolbarLabelRow}>
						<Field.Label {...fieldStyles.label} mb={0} fontSize="2xs">
							Preamp
						</Field.Label>
						<Text
							fontSize="2xs"
							color={ui.colors.textMuted}
							fontVariantNumeric="tabular-nums"
							fontFamily={ui.fonts.mono}
						>
							{presetPreamp.toFixed(1)} dB
						</Text>
					</Flex>
					<Grid
						templateColumns="minmax(0, 1fr) 72px"
						gap={2}
						alignItems="center"
						minH={controlRowMinH}
					>
						<Input
							type="number"
							size="sm"
							min={-30}
							max={12}
							step={0.1}
							h="32px"
							value={presetPreamp}
							{...fieldStyles.control}
							onChange={(e) => setPresetPreamp(Number(e.target.value))}
						/>
					</Grid>
				</Field.Root>

				{showVerifyControls ? (
					<Field.Root minW={{ lg: "220px" }}>
						<Flex {...toolbarLabelRow}>
							<Field.Label {...fieldStyles.label} mb={0} fontSize="2xs">
								Verification
							</Field.Label>
							{hasVerification && verificationMeta && !verificationRunning ? (
								<Text
									fontSize="2xs"
									color={ui.colors.textDim}
									fontVariantNumeric="tabular-nums"
								>
									recorded
								</Text>
							) : (
								<Box />
							)}
						</Flex>
						<HStack
							gap={2}
							minH={controlRowMinH}
							alignItems="center"
							justify={{ base: "flex-start", lg: "flex-end" }}
						>
							{hasVerification ? (
								<Button
									size="sm"
									h="32px"
									borderRadius="2px"
									variant="ghost"
									color={ui.colors.textMuted}
									px={3}
									_hover={{ color: ui.colors.text, bg: ui.colors.inset }}
									disabled={verificationRunning}
									onClick={clearVerification}
								>
									Clear
								</Button>
							) : null}
							<Button
								size="sm"
								h="32px"
								borderRadius="2px"
								whiteSpace="nowrap"
								disabled={!verifyEnabled}
								{...buttonStyles.primary}
								onClick={() =>
									runVerificationMeasurement().catch((error) =>
										alert(
											error instanceof Error ? error.message : String(error),
										),
									)
								}
							>
								{verificationRunning ? "Verifying…" : "Verify correction"}
							</Button>
						</HStack>
					</Field.Root>
				) : null}
			</Grid>

			{verificationRunning ? (
				<Box px={{ base: 3, md: 4 }} pb={3}>
					<MeasurementProgress statusText={statusText} progress={progress} />
				</Box>
			) : null}

			{hasVerification && verificationMeta && !verificationRunning ? (
				<Text
					fontSize="2xs"
					color={ui.colors.textDim}
					fontFamily={ui.fonts.mono}
					px={{ base: 3, md: 4 }}
					pb={3}
					fontVariantNumeric="tabular-nums"
				>
					Last verification: {new Date(verificationMeta.date).toLocaleString()}
				</Text>
			) : null}
		</Box>
	);
}

import {
  Box,
  Button,
  Field,
  Flex,
  Grid,
  HStack,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react';
import type { MeasurementCount } from '../../../types';
import type { RoomEqState } from '../../../hooks/useRoomEq';
import { meterOptimalRangeLabel } from '../../../utils/format';
import {
  buttonStyles,
  fieldStyles,
  setupSectionStyles,
  ui,
} from '../../../theme';
import { FilePicker, FormHelper, FormLabel, LevelMeter } from "../../shared";
import {
	MEASUREMENT_COUNT_OPTIONS,
	MOCK_PRESET_COUNT,
	getMockPresetLabel,
} from "../constants";

interface SessionSettingsSectionProps {
	state: RoomEqState;
	isTestMode: boolean;
}

export function SessionSettingsSection({
	state,
	isTestMode,
}: SessionSettingsSectionProps) {
	const { measurementCount, setMeasurementCount } = state;

	return (
		<SimpleGrid {...setupSectionStyles.fieldGrid}>
			<Field.Root>
				<FormLabel>Measurements per session</FormLabel>
				<NativeSelect.Root size="md">
					<NativeSelect.Field
						{...fieldStyles.control}
						value={measurementCount}
						onChange={(e) =>
							setMeasurementCount(Number(e.target.value) as MeasurementCount)
						}
					>
						{MEASUREMENT_COUNT_OPTIONS.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</NativeSelect.Field>
				</NativeSelect.Root>
				<FormHelper>
					{isTestMode
						? "Each mock preset can include multiple averaged runs."
						: "Run multiple sweeps and average — reduces noise and seat-to-seat variation."}
				</FormHelper>
			</Field.Root>
		</SimpleGrid>
	);
}

interface CalibrationLevelSectionProps {
	state: RoomEqState;
	isTestMode: boolean;
	hardwareDisabled: boolean;
}

export function CalibrationLevelSection({
	state,
	isTestMode,
	hardwareDisabled,
}: CalibrationLevelSectionProps) {
	const {
		calibrationStatus,
		meterActive,
		meterDb,
		handleCalibrationFile,
		handleStartMeter,
		handleStopMeter,
	} = state;

	return (
		<SimpleGrid {...setupSectionStyles.fieldGrid}>
			<Field.Root>
				<FormLabel>Mic calibration file</FormLabel>
				<FilePicker
					accept=".txt,.csv,.cal"
					disabled={hardwareDisabled}
					buttonLabel="Choose file"
					placeholder="No calibration file"
					onFileChange={handleCalibrationFile}
				/>
				<FormHelper>
					{isTestMode ? "Not used in test mode." : calibrationStatus}
				</FormHelper>
			</Field.Root>

			<Box
				{...setupSectionStyles.insetPanel}
				opacity={hardwareDisabled ? 0.55 : 1}
			>
				<Flex
					justify="space-between"
					align="flex-start"
					gap={3}
					mb={3}
					flexWrap="wrap"
				>
					<Stack gap={0.5} flex={1}>
						<Text
							fontSize="xs"
							fontWeight="700"
							color={ui.colors.text}
							letterSpacing="0.04em"
							textTransform="uppercase"
						>
							Pre-measurement level check
						</Text>
						<Text fontSize="2xs" color={ui.colors.textMuted} lineHeight="1.55">
							{isTestMode
								? "Unavailable in test mode — no live audio."
								: `Pink noise at sweep level with live mic meter. Aim for the green zone (${meterOptimalRangeLabel()}).`}
						</Text>
					</Stack>
					{!meterActive ? (
						<Button
							size="sm"
							borderRadius="2px"
							{...buttonStyles.secondary}
							disabled={hardwareDisabled}
							onClick={() => handleStartMeter().catch((e) => alert(e.message))}
						>
							Start level check
						</Button>
					) : (
						<Button
							size="sm"
							borderRadius="2px"
							{...buttonStyles.danger}
							onClick={handleStopMeter}
						>
							Stop
						</Button>
					)}
				</Flex>

				{meterActive && <LevelMeter meterDb={meterDb} />}
			</Box>
		</SimpleGrid>
	);
}

interface TestLoadedPanelProps {
	state: RoomEqState;
}

export function TestLoadedPanel({ state }: TestLoadedPanelProps) {
  const {
    curve,
    mockPresets,
    selectedMockPresetId,
    selectMockPreset,
    regenerateMockLibrary,
    measurementCount,
  } = state;

  const hasLibrary = mockPresets.length > 0;
  const loaded = curve.length > 0;
  const activePreset = mockPresets.find((item) => item.id === selectedMockPresetId);

  return (
		<Box
			p={3}
			borderRadius="2px"
			borderWidth="1px"
			borderColor={ui.colors.borderStrong}
			bg={ui.colors.inset}
		>
			<Text
				fontSize="xs"
				fontWeight="700"
				color={ui.colors.text}
				mb={1}
				letterSpacing="0.06em"
				textTransform="uppercase"
			>
				Test measurement loaded
			</Text>
			<Text fontSize="2xs" color={ui.colors.textMuted} lineHeight="1.6" mb={3}>
				Pick one of {MOCK_PRESET_COUNT} synthetic room responses. Mocks 6–9 are
				resonance stress tests (130 Hz, mid, soprano)
				{measurementCount > 1
					? ` — ${measurementCount} runs averaged per mock.`
					: "."}{" "}
				EQ on the chart updates live for the selected mock.
			</Text>

			<Grid templateColumns="repeat(3, minmax(0, 1fr))" gap={2} mb={3}>
				{Array.from({ length: MOCK_PRESET_COUNT }, (_, index) => {
					const presetId = index + 1;
					const isSelected = selectedMockPresetId === presetId;
					const isReady = mockPresets.some((item) => item.id === presetId);
					const label = getMockPresetLabel(presetId);

					return (
						<Button
							key={presetId}
							size="sm"
							h="32px"
							borderRadius="2px"
							disabled={!isReady}
							{...(isSelected ? buttonStyles.primary : buttonStyles.secondary)}
							onClick={() => selectMockPreset(presetId)}
						>
							{label}
						</Button>
					);
				})}
      </Grid>

      <HStack gap={2} flexWrap="wrap" align="center">
        <Button
          size="sm"
          borderRadius="2px"
          {...buttonStyles.secondary}
          disabled={!hasLibrary}
          onClick={() => regenerateMockLibrary(selectedMockPresetId)}
        >
          Regenerate all mocks
        </Button>
        {loaded && activePreset && (
          <Text fontSize="2xs" color={ui.colors.textDim} fontFamily={ui.fonts.mono}>
            {activePreset.label} · {curve.length} points
          </Text>
        )}
      </HStack>
    </Box>
  );
}

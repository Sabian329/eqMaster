import {
  Box,
  Button,
  Field,
  Flex,
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
import { MEASUREMENT_COUNT_OPTIONS } from "../constants";

interface SessionSettingsSectionProps {
	state: RoomEqState;
}

export function SessionSettingsSection({ state }: SessionSettingsSectionProps) {
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
					Run multiple sweeps and average — reduces noise and seat-to-seat variation.
				</FormHelper>
			</Field.Root>
		</SimpleGrid>
	);
}

interface CalibrationLevelSectionProps {
	state: RoomEqState;
}

export function CalibrationLevelSection({ state }: CalibrationLevelSectionProps) {
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
					buttonLabel="Choose file"
					placeholder="No calibration file"
					onFileChange={handleCalibrationFile}
				/>
				<FormHelper>{calibrationStatus}</FormHelper>
			</Field.Root>

			<Box {...setupSectionStyles.insetPanel}>
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
							Pink noise at sweep level with live mic meter. Aim for the green zone (
							{meterOptimalRangeLabel()}).
						</Text>
					</Stack>
					{!meterActive ? (
						<Button
							size="sm"
							borderRadius="2px"
							{...buttonStyles.secondary}
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

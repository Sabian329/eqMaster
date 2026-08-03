import { useState, type ReactNode } from "react";
import {
	Badge,
	Box,
	Button,
	Card,
	Checkbox,
	Field,
	Flex,
	Heading,
	HStack,
	Input,
	NativeSelect,
	Progress,
	Separator,
	SimpleGrid,
	Slider,
	Stack,
	Stat,
	Tabs,
	Text,
} from "@chakra-ui/react";
import type { MeasurementPresetId } from "../config/measurementPresets";
import type { RoomEqState } from "../hooks/useRoomEq";
import type { ChannelMode, MeasurementCount } from "../types";
import {
	badgeStyles,
	buttonStyles,
	fieldStyles,
	panelStyles,
	statLabelStyle,
	statValueStyle,
	tabStyles,
} from "../theme";
import { dbToMeterPercent, formatDb } from "../utils/format";
import { DeviceStatusAlert } from "./ui/StatusAlert";

interface ConfigPanelProps {
	state: RoomEqState;
}

const CHANNEL_OPTIONS: { value: ChannelMode; label: string }[] = [
	{ value: "both", label: "L + R" },
	{ value: "left", label: "L" },
	{ value: "right", label: "R" },
];

const SMOOTHING_OPTIONS = [
	{ value: 6, label: "1/6 octave" },
	{ value: 12, label: "1/12 octave" },
	{ value: 24, label: "1/24 octave" },
	{ value: 48, label: "1/48 octave" },
];

const DURATION_OPTIONS = [
	{ value: 5, label: "5 s — quick" },
	{ value: 10, label: "10 s — recommended" },
	{ value: 15, label: "15 s — more accurate" },
];

const MEASUREMENT_COUNT_OPTIONS: { value: MeasurementCount; label: string }[] = [
	{ value: 1, label: "1 measurement" },
	{ value: 2, label: "2 measurements (averaged)" },
	{ value: 3, label: "3 measurements (averaged)" },
];

function FormLabel({ children }: { children: ReactNode }) {
	return <Field.Label {...fieldStyles.label}>{children}</Field.Label>;
}

function FormHelper({ children }: { children: ReactNode }) {
	return (
		<Field.HelperText {...fieldStyles.helper}>{children}</Field.HelperText>
	);
}

export function ConfigPanel({ state }: ConfigPanelProps) {
	const [formMode, setFormMode] = useState<"simple" | "advanced">("simple");

	const {
		env,
		sinkHelp,
		deviceStatus,
		inputs,
		outputs,
		inputDeviceId,
		setInputDeviceId,
		outputDeviceId,
		setOutputDeviceId,
		channel,
		setChannel,
		fStart,
		setFStart,
		fEnd,
		setFEnd,
		duration,
		setDuration,
		smoothing,
		setSmoothing,
		level,
		setLevel,
		measurementCount,
		setMeasurementCount,
		safetyCheck,
		setSafetyCheck,
		calibrationStatus,
		statusText,
		progress,
		meterActive,
		meterDb,
		measureEnabled,
		activeMeasurementPresetId,
		applyMeasurementPreset,
		measurementPresets,
		handleRequestPermission,
		handleChooseOutput,
		handleRefreshDevices,
		handleCalibrationFile,
		handleStartMeter,
		handleStopMeter,
		handleStartSession,
	} = state;

	const levelLabel = `${String(level).replace("-", "−")} dB`;
	const activePreset = measurementPresets.find(
		(p) => p.id === activeMeasurementPresetId,
	);

  return (
    <Card.Root w="full" {...panelStyles.root}>
			<Card.Header {...panelStyles.header}>
				<Heading size="md" fontWeight="semibold" color="gray.100">
					Measurement setup
				</Heading>
			</Card.Header>

			<Card.Body {...panelStyles.body}>
				<Box maxW="980px" mx="auto" w="full">
					<Stack gap={6}>
						<Tabs.Root
							value={formMode}
							onValueChange={(details) =>
								setFormMode(details.value as "simple" | "advanced")
							}
							variant="enclosed"
						>
							<Tabs.List {...tabStyles.list} maxW="360px">
								<Tabs.Trigger value="simple" {...tabStyles.trigger} flex={1}>
									Simple
								</Tabs.Trigger>
								<Tabs.Trigger value="advanced" {...tabStyles.trigger} flex={1}>
									Advanced
								</Tabs.Trigger>
							</Tabs.List>

							<Tabs.Content value="simple" pt={5}>
								<Stack gap={5}>
									<SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
										<Field.Root>
											<FormLabel>Scene preset</FormLabel>
											<NativeSelect.Root size="md">
												<NativeSelect.Field
													{...fieldStyles.control}
													value={activeMeasurementPresetId}
													onChange={(e) =>
														applyMeasurementPreset(
															e.target.value as MeasurementPresetId,
														)
													}
												>
													{measurementPresets.map((preset) => (
														<option key={preset.id} value={preset.id}>
															{preset.name} — {preset.tagline}
														</option>
													))}
												</NativeSelect.Field>
											</NativeSelect.Root>
											{activePreset && (
												<FormHelper>{activePreset.description}</FormHelper>
											)}
										</Field.Root>

										<Field.Root>
											<FormLabel>Measured channel</FormLabel>
											<NativeSelect.Root size="md">
												<NativeSelect.Field
													{...fieldStyles.control}
													value={channel}
													onChange={(e) =>
														setChannel(e.target.value as ChannelMode)
													}
												>
													{CHANNEL_OPTIONS.map((opt) => (
														<option key={opt.value} value={opt.value}>
															{opt.label}
														</option>
													))}
												</NativeSelect.Field>
											</NativeSelect.Root>
											<FormHelper>
												Speaker channel for this measurement run.
											</FormHelper>
										</Field.Root>
									</SimpleGrid>

									<Box
										p={4}
										borderRadius="xl"
										bg="whiteAlpha.50"
										borderWidth="1px"
										borderColor="whiteAlpha.100"
									>
										<HStack justify="space-between" mb={4}>
											<Text fontSize="sm" fontWeight="medium" color="gray.300">
												Preset summary
											</Text>
											{activePreset && (
												<Badge {...badgeStyles.info}>{activePreset.name}</Badge>
											)}
										</HStack>
										<SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
											<Stat.Root size="sm">
												<Stat.Label {...statLabelStyle}>Range</Stat.Label>
												<Stat.ValueText {...statValueStyle} fontSize="sm">
													{fStart} – {fEnd} Hz
												</Stat.ValueText>
											</Stat.Root>
											<Stat.Root size="sm">
												<Stat.Label {...statLabelStyle}>Sweep</Stat.Label>
												<Stat.ValueText {...statValueStyle} fontSize="sm">
													{duration} s
												</Stat.ValueText>
											</Stat.Root>
											<Stat.Root size="sm">
												<Stat.Label {...statLabelStyle}>Smoothing</Stat.Label>
												<Stat.ValueText {...statValueStyle} fontSize="sm">
													{
														SMOOTHING_OPTIONS.find((o) => o.value === smoothing)
															?.label
													}
												</Stat.ValueText>
											</Stat.Root>
											<Stat.Root size="sm">
												<Stat.Label {...statLabelStyle}>Level</Stat.Label>
												<Stat.ValueText {...statValueStyle} fontSize="sm">
													{levelLabel}
												</Stat.ValueText>
											</Stat.Root>
										</SimpleGrid>
									</Box>
								</Stack>
							</Tabs.Content>

							<Tabs.Content value="advanced" pt={5}>
								<Stack gap={5}>
									<HStack gap={2} flexWrap="wrap">
										<Button
											size="sm"
											borderRadius="lg"
											{...buttonStyles.secondary}
											onClick={() =>
												handleRequestPermission().catch((e) => alert(e.message))
											}
										>
											Show inputs
										</Button>
										<Button
											size="sm"
											borderRadius="lg"
											{...buttonStyles.secondary}
											disabled={!env.supportsOutputPicker}
											title={sinkHelp}
											onClick={() =>
												handleChooseOutput().catch((e) => {
													if (e?.name !== "NotAllowedError") alert(e.message);
												})
											}
										>
											Choose output
										</Button>
										<Button
											size="sm"
											borderRadius="lg"
											{...buttonStyles.secondary}
											onClick={() =>
												handleRefreshDevices().catch((e) => alert(e.message))
											}
										>
											Refresh
										</Button>
									</HStack>

									<DeviceStatusAlert
										message={deviceStatus.message}
										type={deviceStatus.type}
									/>

									<SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
										<Field.Root>
											<FormLabel>Microphone input</FormLabel>
											<NativeSelect.Root size="md">
												<NativeSelect.Field
													{...fieldStyles.control}
													value={inputDeviceId}
													onChange={(e) => setInputDeviceId(e.target.value)}
												>
													<option value="">Default input</option>
													{inputs.map((device, index) => (
														<option key={device.deviceId} value={device.deviceId}>
															{device.label ||
																`Input ${index + 1} — name hidden by browser`}
														</option>
													))}
												</NativeSelect.Field>
											</NativeSelect.Root>
										</Field.Root>

										<Field.Root>
											<FormLabel>Audio output</FormLabel>
											<NativeSelect.Root size="md" disabled={!env.supportsSink}>
												<NativeSelect.Field
													{...fieldStyles.control}
													value={outputDeviceId}
													onChange={(e) => setOutputDeviceId(e.target.value)}
												>
													<option value="">System default output</option>
													{outputs.map((device, index) => (
														<option key={device.deviceId} value={device.deviceId}>
															{device.label ||
																`Output ${index + 1} — name hidden by browser`}
														</option>
													))}
												</NativeSelect.Field>
											</NativeSelect.Root>
											<FormHelper>{sinkHelp}</FormHelper>
										</Field.Root>
									</SimpleGrid>

									<SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={4}>
										<Field.Root>
											<FormLabel>Start [Hz]</FormLabel>
											<Input
												type="number"
												min={10}
												max={1000}
												step={1}
												value={fStart}
												{...fieldStyles.control}
												onChange={(e) => setFStart(Number(e.target.value))}
											/>
										</Field.Root>
										<Field.Root>
											<FormLabel>End [Hz]</FormLabel>
											<Input
												type="number"
												min={1000}
												max={24000}
												step={100}
												value={fEnd}
												{...fieldStyles.control}
												onChange={(e) => setFEnd(Number(e.target.value))}
											/>
										</Field.Root>
										<Field.Root>
											<FormLabel>Sweep length</FormLabel>
											<NativeSelect.Root size="md">
												<NativeSelect.Field
													{...fieldStyles.control}
													value={duration}
													onChange={(e) => setDuration(Number(e.target.value))}
												>
													{DURATION_OPTIONS.map((opt) => (
														<option key={opt.value} value={opt.value}>
															{opt.label}
														</option>
													))}
												</NativeSelect.Field>
											</NativeSelect.Root>
										</Field.Root>
										<Field.Root>
											<FormLabel>Smoothing</FormLabel>
											<NativeSelect.Root size="md">
												<NativeSelect.Field
													{...fieldStyles.control}
													value={smoothing}
													onChange={(e) => setSmoothing(Number(e.target.value))}
												>
													{SMOOTHING_OPTIONS.map((opt) => (
														<option key={opt.value} value={opt.value}>
															{opt.label}
														</option>
													))}
												</NativeSelect.Field>
											</NativeSelect.Root>
										</Field.Root>
									</SimpleGrid>

									<SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
										<Field.Root>
											<FormLabel>Measurements per session</FormLabel>
											<NativeSelect.Root size="md">
												<NativeSelect.Field
													{...fieldStyles.control}
													value={measurementCount}
													onChange={(e) =>
														setMeasurementCount(
															Number(e.target.value) as MeasurementCount,
														)
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
												Average multiple sweeps; finish early anytime.
											</FormHelper>
										</Field.Root>

										<Field.Root>
											<Flex justify="space-between" align="center" mb={2}>
												<Field.Label {...fieldStyles.label} mb={0}>
													Sweep digital level
												</Field.Label>
												<Badge {...badgeStyles.info}>{levelLabel}</Badge>
											</Flex>
											<Slider.Root
												w="full"
												min={-36}
												max={-6}
												step={1}
												value={[level]}
												onValueChange={(details) => setLevel(details.value[0])}
												variant="outline"
												colorPalette="brand"
												size="md"
											>
												<Slider.Control py={2} w="full">
													<Slider.Track bg="whiteAlpha.300" shadow="inset">
														<Slider.Range bg="brand.400" />
													</Slider.Track>
													<Slider.Thumbs />
												</Slider.Control>
											</Slider.Root>
											<FormHelper>Not SPL — depends on interface and monitors.</FormHelper>
										</Field.Root>
									</SimpleGrid>

									<SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
										<Field.Root>
											<FormLabel>Microphone calibration — optional</FormLabel>
											<Input
												type="file"
												accept=".txt,.csv,.cal"
												pt={1}
												{...fieldStyles.control}
												onChange={(e) => {
													const file = e.target.files?.[0] ?? null;
													void handleCalibrationFile(file);
												}}
											/>
											<FormHelper>{calibrationStatus}</FormHelper>
										</Field.Root>

										<Box
											p={4}
											borderRadius="xl"
											borderWidth="1px"
											borderColor="whiteAlpha.100"
											bg="whiteAlpha.40"
										>
											<Text
												fontSize="sm"
												fontWeight="medium"
												color="gray.300"
												mb={1}
											>
												Level check
											</Text>
											<Text fontSize="xs" color="gray.500" mb={3} lineHeight="1.55">
												Pink noise at sweep level + live mic meter.
											</Text>
											{!meterActive ? (
												<Button
													size="sm"
													borderRadius="lg"
													{...buttonStyles.secondary}
													onClick={() =>
														handleStartMeter().catch((e) => alert(e.message))
													}
												>
													Start level check
												</Button>
											) : (
												<Button
													size="sm"
													borderRadius="lg"
													{...buttonStyles.danger}
													onClick={handleStopMeter}
												>
													Stop level check
												</Button>
											)}

											{meterActive && (
												<HStack mt={4} gap={3}>
													<Box
														flex={1}
														h="10px"
														borderRadius="full"
														overflow="hidden"
														borderWidth="1px"
														borderColor="whiteAlpha.200"
														bg="linear-gradient(90deg, rgba(85,214,139,.15) 0 72%, rgba(255,191,90,.18) 72% 90%, rgba(255,114,114,.18) 90% 100%)"
													>
														<Box
															h="full"
															w={`${dbToMeterPercent(meterDb)}%`}
															bg="linear-gradient(90deg, #55d68b, #ffbf5a 78%, #ff7272)"
															transition="width 0.06s linear"
														/>
													</Box>
													<Text
														fontSize="xs"
														color="gray.400"
														minW="72px"
														textAlign="right"
														fontVariantNumeric="tabular-nums"
													>
														{formatDb(meterDb)}FS
													</Text>
												</HStack>
											)}
										</Box>
									</SimpleGrid>
								</Stack>
							</Tabs.Content>
						</Tabs.Root>

						<Separator borderColor="whiteAlpha.100" />

						<SimpleGrid columns={{ base: 1, lg: 2 }} gap={4} alignItems="center">
							<Box
								p={4}
								borderRadius="xl"
								borderWidth="1px"
								borderColor="whiteAlpha.100"
								bg="whiteAlpha.30"
							>
								<Checkbox.Root
									checked={safetyCheck}
									onCheckedChange={(details) => setSafetyCheck(!!details.checked)}
									alignItems="flex-start"
									gap={3}
								>
									<Checkbox.HiddenInput />
									<Checkbox.Control
										mt={0.5}
										borderColor="whiteAlpha.300"
										_checked={{ bg: "brand.400", borderColor: "brand.400" }}
									/>
									<Checkbox.Label fontSize="sm" lineHeight="1.55" color="gray.300">
										I set a low volume, disabled direct monitoring, and the
										microphone is not positioned where feedback is likely.
									</Checkbox.Label>
								</Checkbox.Root>
							</Box>

							<Button
								size="lg"
								borderRadius="xl"
								disabled={!measureEnabled}
								{...buttonStyles.primary}
								onClick={() => handleStartSession().catch((e) => alert(e.message))}
							>
								Start measurement
							</Button>
						</SimpleGrid>

						<Box>
							<Flex justify="space-between" fontSize="sm" color="gray.400" mb={2}>
								<Text color="gray.300">{statusText}</Text>
								<Text fontVariantNumeric="tabular-nums">
									{Math.round(progress)}%
								</Text>
							</Flex>
							<Progress.Root value={progress} size="sm">
								<Progress.Track bg="surface.inset" borderRadius="full" h="9px">
									<Progress.Range bg="brand.400" borderRadius="full" />
								</Progress.Track>
							</Progress.Root>
						</Box>

						<Text fontSize="xs" color="gray.500" lineHeight="1.65">
							The chart is relative: the ~500–2000 Hz range is normalized to 0 dB.
							Without an SPL calibrator, the app does not show exact in-room
							loudness.
						</Text>
					</Stack>
				</Box>
			</Card.Body>
		</Card.Root>
	);
}

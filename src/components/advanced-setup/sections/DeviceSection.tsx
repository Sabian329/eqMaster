import {
	Box,
	Field,
	NativeSelect,
	SimpleGrid,
	Stack,
	Text,
} from "@chakra-ui/react";
import type { ChannelMode } from "../../../types";
import type { RoomEqState } from "../../../hooks/useRoomEq";
import { fieldStyles, setupSectionStyles } from "../../../theme";
import { DeviceActionButtons, FormHelper, FormLabel } from "../../shared";
import { CHANNEL_OPTIONS } from "../constants";

interface DeviceSectionProps {
	state: RoomEqState;
}

export function DeviceSection({ state }: DeviceSectionProps) {
	const {
		env,
		sinkHelp,
		inputs,
		outputs,
		inputDeviceId,
		setInputDeviceId,
		outputDeviceId,
		setOutputDeviceId,
		channel,
		setChannel,
		handleRequestPermission,
		handleChooseOutput,
		handleRefreshDevices,
	} = state;

	return (
		<Stack gap={4}>
			<Box {...setupSectionStyles.actionBar}>
				<Text fontSize="xs" fontWeight="medium" color="gray.500" mb={2.5}>
					Device access
				</Text>
				<DeviceActionButtons
					env={env}
					sinkHelp={sinkHelp}
					onRequestPermission={handleRequestPermission}
					onChooseOutput={handleChooseOutput}
					onRefreshDevices={handleRefreshDevices}
				/>
			</Box>

			<SimpleGrid {...setupSectionStyles.fieldGrid}>
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
					<FormHelper>Measurement microphone or interface input.</FormHelper>
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

				<Field.Root gridColumn={{ md: "1 / -1" }}>
					<FormLabel>Measured channel</FormLabel>
					<NativeSelect.Root size="md">
						<NativeSelect.Field
							{...fieldStyles.control}
							maxW={{ md: "280px" }}
							value={channel}
							onChange={(e) => setChannel(e.target.value as ChannelMode)}
						>
							{CHANNEL_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</NativeSelect.Field>
					</NativeSelect.Root>
					<FormHelper>
						Which speaker channel the sweep excites during this session.
					</FormHelper>
				</Field.Root>
			</SimpleGrid>
		</Stack>
	);
}

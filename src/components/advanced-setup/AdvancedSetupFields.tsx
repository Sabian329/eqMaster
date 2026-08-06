import { Stack } from "@chakra-ui/react";
import { SetupSection } from "./SetupSection";
import { DeviceSection } from "./sections/DeviceSection";
import { SweepSection } from "./sections/SweepSection";
import {
	CalibrationLevelSection,
	SessionSettingsSection,
} from "./sections/SessionSettingsSection";
import type { AdvancedSetupFieldsProps } from "./types";

export function AdvancedSetupFields({ state }: AdvancedSetupFieldsProps) {
	return (
		<Stack gap={3}>
			<SetupSection
				title="Audio routing"
				subtitle="Select capture and playback devices. Grant browser permissions before measuring."
			>
				<DeviceSection state={state} />
			</SetupSection>

			<SetupSection
				title="Sweep parameters"
				subtitle="Logarithmic sine sweep range, duration, and analysis smoothing."
			>
				<SweepSection state={state} />
			</SetupSection>

			<SetupSection
				title="Session"
				subtitle="Number of averaged runs per measurement session."
			>
				<SessionSettingsSection state={state} />
			</SetupSection>

			<SetupSection
				title="Calibration & verification"
				subtitle="Optional mic correction file and pre-flight level check."
			>
				<CalibrationLevelSection state={state} />
			</SetupSection>
		</Stack>
	);
}

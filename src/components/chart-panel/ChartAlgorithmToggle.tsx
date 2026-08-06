import { Stack, Tabs, Text } from "@chakra-ui/react";
import type { RoomEqState } from "../../hooks/useRoomEq";
import { EQ_ALGORITHMS, type EqAlgorithmVersion } from "../../config/eqAlgorithms";
import { tabStyles, ui } from "../../theme";

interface ChartAlgorithmToggleProps {
	eqAlgorithmVersion: EqAlgorithmVersion;
	setEqAlgorithmVersion: (version: EqAlgorithmVersion) => void;
}

export function ChartAlgorithmToggle({
	eqAlgorithmVersion,
	setEqAlgorithmVersion,
}: ChartAlgorithmToggleProps) {
	const active =
		EQ_ALGORITHMS.find((item) => item.id === eqAlgorithmVersion) ??
		EQ_ALGORITHMS[0];

	return (
		<Stack gap={1.5} mb={3}>
			<Tabs.Root
				value={eqAlgorithmVersion}
				onValueChange={(details) =>
					setEqAlgorithmVersion(details.value as EqAlgorithmVersion)
				}
				variant="enclosed"
			>
				<Tabs.List {...tabStyles.list} maxW="420px">
					{EQ_ALGORITHMS.map((algorithm) => (
						<Tabs.Trigger
							key={algorithm.id}
							value={algorithm.id}
							{...tabStyles.trigger}
							flex={1}
						>
							{algorithm.label}
						</Tabs.Trigger>
					))}
				</Tabs.List>
			</Tabs.Root>
			<Text
				fontSize="2xs"
				color={ui.colors.textDim}
				fontFamily={ui.fonts.mono}
				pl={0.5}
			>
				{active.description}
			</Text>
		</Stack>
	);
}

export function ChartAlgorithmToggleFromState({
	state,
}: {
	state: Pick<RoomEqState, "eqAlgorithmVersion" | "setEqAlgorithmVersion">;
}) {
	return (
		<ChartAlgorithmToggle
			eqAlgorithmVersion={state.eqAlgorithmVersion}
			setEqAlgorithmVersion={state.setEqAlgorithmVersion}
		/>
	);
}

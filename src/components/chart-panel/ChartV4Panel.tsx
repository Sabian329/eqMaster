import { Button, Collapsible, Stack, Text } from "@chakra-ui/react";
import type { RoomEqState } from "../../hooks/useRoomEq";
import { ui } from "../../theme";
import {
	ChartRecalculateBar,
	formatAutoEqProgressLabel,
} from "./ChartRecalculateBar";

interface ChartV4PanelProps {
	state: Pick<
		RoomEqState,
		| "eqAlgorithmVersion"
		| "recalculateV4AutoEq"
		| "autoEqV4Progress"
		| "autoEqV4IsRunning"
		| "autoEqV4Result"
		| "autoEqV4Error"
		| "curve"
		| "v4ScaleView"
		| "setV4ScaleView"
	>;
}

function formatStopReason(reason: string): string {
	return reason.replace(/-/g, " ");
}

const SCALE_OPTIONS = [
	{ id: "1/24" as const, label: "1/24" },
	{ id: "1/12" as const, label: "1/12" },
	{ id: "1/6" as const, label: "1/6" },
	{ id: "1/3" as const, label: "1/3" },
];

export function ChartV4Panel({ state }: ChartV4PanelProps) {
	const {
		eqAlgorithmVersion,
		recalculateV4AutoEq,
		autoEqV4Progress,
		autoEqV4IsRunning,
		autoEqV4Result,
		autoEqV4Error,
		curve,
		v4ScaleView,
		setV4ScaleView,
	} = state;

	if (eqAlgorithmVersion !== "v4" || curve.length === 0) {
		return null;
	}

	const v4 = autoEqV4Result?.v4;
	const diagnostics = v4?.diagnostics;

	return (
		<Stack gap={0} bg={ui.colors.chart}>
			<ChartRecalculateBar
				versionLabel="V4"
				statusLabel={
					autoEqV4Error
						? "Requires native 1/24"
						: formatAutoEqProgressLabel(autoEqV4Progress, "Precision 1/24")
				}
				isRunning={autoEqV4IsRunning}
				onRecalculate={recalculateV4AutoEq}
			/>

			{autoEqV4Error ? (
				<Text
					px={3}
					py={2}
					fontSize="2xs"
					color={ui.colors.textMuted}
					fontFamily={ui.fonts.mono}
					borderTopWidth="1px"
					borderColor={ui.colors.border}
				>
					{autoEqV4Error}
				</Text>
			) : null}

			{v4 && (
				<>
					<Stack
						direction="row"
						gap={2}
						px={3}
						py={2}
						borderTopWidth="1px"
						borderColor={ui.colors.border}
						align="center"
					>
						<Text
							fontSize="2xs"
							color={ui.colors.textDim}
							fontFamily={ui.fonts.mono}
						>
							Scale
						</Text>
						{SCALE_OPTIONS.map((option) => (
							<Button
								key={option.id}
								size="xs"
								h="22px"
								px={2}
								borderRadius="2px"
								variant={v4ScaleView === option.id ? "solid" : "ghost"}
								onClick={() => setV4ScaleView(option.id)}
							>
								{option.label}
							</Button>
						))}
					</Stack>

					<Collapsible.Root defaultOpen={false}>
						<Collapsible.Trigger asChild>
							<Button
								variant="ghost"
								w="full"
								justifyContent="flex-start"
								borderRadius={0}
								borderTopWidth="1px"
								borderColor={ui.colors.border}
								color={ui.colors.textMuted}
								fontSize="2xs"
								fontFamily={ui.fonts.mono}
								px={3}
								py={2}
							>
								V4 diagnostics
							</Button>
						</Collapsible.Trigger>
						<Collapsible.Content px={3} pb={3}>
							<Stack
								gap={1}
								fontSize="2xs"
								color={ui.colors.textMuted}
								fontFamily={ui.fonts.mono}
							>
								<Text>Filters used: {v4.filters.length}</Text>
								<Text>
									Resonance candidates:{" "}
									{diagnostics?.resonanceCandidateCount ?? 0}
								</Text>
								<Text>
									Tonal candidates: {diagnostics?.tonalCandidateCount ?? 0}
								</Text>
								<Text>
									Single-bin artifacts:{" "}
									{diagnostics?.rejectedSingleBinCount ?? 0}
								</Text>
								<Text>
									Rejected nulls: {diagnostics?.rejectedNullCount ?? 0}
								</Text>
								<Text>
									Comb filtering features:{" "}
									{diagnostics?.rejectedCombFilteringCount ?? 0}
								</Text>
								<Text>
									RMS 1/24: {v4.weightedRms1_24BeforeDb.toFixed(2)} →{" "}
									{v4.weightedRms1_24AfterDb.toFixed(2)} dB
								</Text>
								<Text>
									RMS 1/12: {v4.weightedRms1_12BeforeDb.toFixed(2)} →{" "}
									{v4.weightedRms1_12AfterDb.toFixed(2)} dB
								</Text>
								<Text>
									Broad RMS: {v4.broadRmsBeforeDb.toFixed(2)} →{" "}
									{v4.broadRmsAfterDb.toFixed(2)} dB
								</Text>
								<Text>
									Overcut area: {v4.overcutAreaBeforeDbOct.toFixed(3)} →{" "}
									{v4.overcutAreaAfterDbOct.toFixed(3)} dB·oct
								</Text>
								<Text>
									Beam iterations: {diagnostics?.beamIterations ?? 0}
								</Text>
								<Text>
									Optimization passes: {diagnostics?.optimizationPasses ?? 0}
								</Text>
								<Text>Stop reason: {formatStopReason(v4.stopReason)}</Text>
								<Text>
									Execution time: {v4.executionTimeMs.toFixed(0)} ms
								</Text>
								<Text>Preamp: {v4.preampDb.toFixed(2)} dB</Text>
							</Stack>
						</Collapsible.Content>
					</Collapsible.Root>
				</>
			)}
		</Stack>
	);
}

export function ChartV4PanelFromState({
	state,
}: {
	state: ChartV4PanelProps["state"];
}) {
	return <ChartV4Panel state={state} />;
}

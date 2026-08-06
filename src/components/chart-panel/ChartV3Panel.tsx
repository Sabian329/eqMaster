import { Button, Collapsible, Stack, Text } from "@chakra-ui/react";
import type { RoomEqState } from "../../hooks/useRoomEq";
import { ui } from "../../theme";
import {
	ChartRecalculateBar,
	formatAutoEqProgressLabel,
} from "./ChartRecalculateBar";

interface ChartV3PanelProps {
	state: Pick<
		RoomEqState,
		| "eqAlgorithmVersion"
		| "recalculateV3AutoEq"
		| "autoEqV3Progress"
		| "autoEqV3IsRunning"
		| "autoEqV3Result"
		| "curve"
	>;
}

function formatStopReason(reason: string): string {
	return reason.replace(/-/g, " ");
}

export function ChartV3Panel({ state }: ChartV3PanelProps) {
	const {
		eqAlgorithmVersion,
		recalculateV3AutoEq,
		autoEqV3Progress,
		autoEqV3IsRunning,
		autoEqV3Result,
		curve,
	} = state;

	if (eqAlgorithmVersion !== "v3" || curve.length === 0) {
		return null;
	}

	const v3 = autoEqV3Result?.v3;
	const diagnostics = v3?.diagnostics;

	return (
		<Stack gap={0} bg={ui.colors.chart}>
			<ChartRecalculateBar
				versionLabel="V3.1"
				statusLabel={formatAutoEqProgressLabel(autoEqV3Progress)}
				isRunning={autoEqV3IsRunning}
				onRecalculate={recalculateV3AutoEq}
			/>

			{v3 && (
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
							V3.1 diagnostics
						</Button>
					</Collapsible.Trigger>
					<Collapsible.Content px={3} pb={3}>
						<Stack
							gap={1}
							fontSize="2xs"
							color={ui.colors.textMuted}
							fontFamily={ui.fonts.mono}
						>
							<Text>
								Filters before pruning:{" "}
								{diagnostics?.filtersBeforePruning ?? v3.filtersBeforePruning}
							</Text>
							<Text>
								Filters after pruning:{" "}
								{diagnostics?.filtersAfterPruning ?? v3.filtersAfterPruning}
							</Text>
							<Text>
								Filters after safety pass:{" "}
								{diagnostics?.filtersAfterSafetyPass ??
									v3.filtersAfterSafetyPass}
							</Text>
							<Text>
								Resonance candidates:{" "}
								{diagnostics?.resonanceCandidateCount ??
									v3.candidateCount.resonance}
							</Text>
							<Text>
								Tonal candidates:{" "}
								{diagnostics?.tonalCandidateCount ?? v3.candidateCount.tonal}
							</Text>
							<Text>
								Shelf candidates:{" "}
								{diagnostics?.shelfCandidateCount ?? v3.candidateCount.shelf}
							</Text>
							<Text>
								Rejected overcut candidates:{" "}
								{diagnostics?.rejectedOvercutCount ?? v3.rejectedOvercutCount}
							</Text>
							<Text>
								Weakened filters:{" "}
								{diagnostics?.weakenedFilterCount ?? v3.weakenedFilterCount}
							</Text>
							<Text>
								RMS before:{" "}
								{(
									diagnostics?.weightedRmsBeforeDb ?? v3.weightedRmsBeforeDb
								).toFixed(2)}{" "}
								dB
							</Text>
							<Text>
								RMS after:{" "}
								{(
									diagnostics?.weightedRmsAfterDb ?? v3.weightedRmsAfterDb
								).toFixed(2)}{" "}
								dB
							</Text>
							<Text>
								Broad RMS before:{" "}
								{(diagnostics?.broadRmsBeforeDb ?? v3.broadRmsBeforeDb).toFixed(
									2,
								)}{" "}
								dB
							</Text>
							<Text>
								Broad RMS after:{" "}
								{(diagnostics?.broadRmsAfterDb ?? v3.broadRmsAfterDb).toFixed(2)}{" "}
								dB
							</Text>
							<Text>
								Overcut area before:{" "}
								{(
									diagnostics?.overcutAreaBeforeDbOct ??
									v3.overcutAreaBeforeDbOct
								).toFixed(2)}
							</Text>
							<Text>
								Overcut area after:{" "}
								{(
									diagnostics?.overcutAreaAfterDbOct ??
									v3.overcutAreaAfterDbOct
								).toFixed(2)}
							</Text>
							<Text>
								Maximum broad overcut:{" "}
								{(
									diagnostics?.maximumBroadOvercutAfterDb ??
									v3.maximumBroadOvercutAfterDb
								).toFixed(2)}{" "}
								dB
							</Text>
							<Text>
								Maximum EQ boost: {v3.maximumCombinedBoostDb.toFixed(2)} dB
							</Text>
							<Text>
								Maximum EQ cut:{" "}
								{(
									diagnostics?.maximumCombinedCutDb ?? v3.maximumCombinedCutDb
								).toFixed(2)}{" "}
								dB
							</Text>
							<Text>Preamp: {v3.preampDb.toFixed(2)} dB</Text>
							<Text>Stop reason: {formatStopReason(v3.stopReason)}</Text>
							<Text>Execution time: {v3.executionTimeMs.toFixed(0)} ms</Text>
						</Stack>
					</Collapsible.Content>
				</Collapsible.Root>
			)}
		</Stack>
	);
}

export function ChartV3PanelFromState({
	state,
}: {
	state: ChartV3PanelProps["state"];
}) {
	return <ChartV3Panel state={state} />;
}

import { Box, Card } from "@chakra-ui/react";
import { panelStyles, ui } from "../../theme";
import { ChartAlgorithmToggleFromState } from "./ChartAlgorithmToggle";
import { ChartV2RecalculateFromState } from "./ChartV2Recalculate";
import { ChartV3PanelFromState } from "./ChartV3Panel";
import { ChartEqEditor } from "./chart-eq-editor";
import { resolveChartFrequencyRange } from "./constants";
import { ChartHeader } from "./ChartHeader";
import { FrequencyChart } from "./frequency-chart";
import { SavedMeasurementsList } from "./SavedMeasurementsList";
import type { ChartPanelProps } from "./types";

export function ChartPanel({ state }: ChartPanelProps) {
	const {
		chartSeries,
		visibleChartSeries,
		isChartSeriesVisible,
		toggleChartSeriesVisibility,
		showCorrectionFills,
		toggleCorrectionFills,
		filterOverlays,
		measurementMeta,
		measurementRuns,
		averagedRun,
		autoEqV2IsRunning,
		autoEqV3IsRunning,
	} = state;
	const displayMeta =
		averagedRun?.meta ??
		measurementRuns[measurementRuns.length - 1]?.meta ??
		measurementMeta;
	const { fMin, fMax } = resolveChartFrequencyRange(
		chartSeries,
		displayMeta?.fMin ?? 40,
	);
	const isAlgorithmLoading = autoEqV2IsRunning || autoEqV3IsRunning;

	return (
		<Card.Root w="full" {...panelStyles.root} id="frequency-chart-panel">
			<Card.Header {...panelStyles.header}>
				<SavedMeasurementsList state={state} />
				<ChartHeader
					chartSeries={chartSeries}
					isChartSeriesVisible={isChartSeriesVisible}
					onToggleChartSeries={toggleChartSeriesVisibility}
					showCorrectionFills={showCorrectionFills}
					onToggleCorrectionFills={toggleCorrectionFills}
					hasCorrectionFills={filterOverlays.length > 0}
				/>
				<ChartAlgorithmToggleFromState state={state} />
			</Card.Header>

			<Box
				position="sticky"
				top={{ base: 0, md: 2 }}
				zIndex={2}
				bg={ui.colors.chart}
				boxShadow="none"
				borderTopWidth="1px"
				borderColor={ui.colors.border}
			>
				<Box minH={{ base: "220px", md: "260px" }} position="relative">
					<FrequencyChart
						series={visibleChartSeries}
						fMin={fMin}
						fMax={fMax}
						suggestions={state.suggestions}
						filterOverlays={showCorrectionFills ? filterOverlays : []}
						onAddCustomBand={
							isAlgorithmLoading ? undefined : state.addCustomBand
						}
					/>
					{isAlgorithmLoading ? (
						<Box
							position="absolute"
							top={0}
							right={0}
							bottom={0}
							left={0}
							zIndex={5}
							cursor="not-allowed"
							bg="rgba(0, 0, 0, 0.22)"
							css={{ backdropFilter: "grayscale(1)" }}
							aria-busy="true"
							aria-label="Algorithm loading"
							pointerEvents="auto"
						/>
					) : null}
				</Box>

				<ChartV2RecalculateFromState state={state} />
				<ChartV3PanelFromState state={state} />

				<ChartEqEditor state={state} />
			</Box>
		</Card.Root>
	);
}

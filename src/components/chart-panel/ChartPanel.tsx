import { Box, Card } from '@chakra-ui/react';
import { panelStyles, ui } from '../../theme';
import { ChartAlgorithmToggleFromState } from './ChartAlgorithmToggle';
import { ChartV2RecalculateFromState } from './ChartV2Recalculate';
import { ChartV3PanelFromState } from './ChartV3Panel';
import { ChartEqEditor } from './chart-eq-editor';
import { resolveChartFrequencyRange } from './constants';
import { ChartHeader } from './ChartHeader';
import { FrequencyChart } from './frequency-chart';
import type { ChartPanelProps } from './types';

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
  } = state;
  const displayMeta =
    averagedRun?.meta ??
    measurementRuns[measurementRuns.length - 1]?.meta ??
    measurementMeta;
  const { fMin, fMax } = resolveChartFrequencyRange(
    chartSeries,
    displayMeta?.fMin ?? 40,
  );

  return (
    <Card.Root w="full" {...panelStyles.root} id="frequency-chart-panel">
      <Card.Header {...panelStyles.header}>
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
        <Box minH={{ base: '220px', md: '260px' }} position="relative">
          <FrequencyChart
            series={visibleChartSeries}
            fMin={fMin}
            fMax={fMax}
            suggestions={state.suggestions}
            filterOverlays={showCorrectionFills ? filterOverlays : []}
            onAddCustomBand={state.addCustomBand}
          />
        </Box>

        <ChartV2RecalculateFromState state={state} />
        <ChartV3PanelFromState state={state} />

        <ChartEqEditor state={state} />
      </Box>
    </Card.Root>
  );
}

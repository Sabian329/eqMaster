import { Box, Card } from '@chakra-ui/react';
import { panelStyles } from '../../theme';
import { ChartEqEditor } from './chart-eq-editor';
import { resolveChartFrequencyRange, resolveDisplayMeta } from './constants';
import { ChartHeader } from './ChartHeader';
import { ChartStatsGrid } from './ChartStatsGrid';
import { VerificationPanel } from './VerificationPanel';
import { FrequencyChart } from './frequency-chart';
import type { ChartPanelProps } from './types';

export function ChartPanel({ state }: ChartPanelProps) {
  const {
    chartSeries,
    visibleChartSeries,
    isChartSeriesVisible,
    toggleChartSeriesVisibility,
    showFilterOverlays,
    filterOverlays,
  } = state;
  const displayMeta = resolveDisplayMeta(state);
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
        />
      </Card.Header>

      <Box
        position="sticky"
        top={{ base: 0, md: 2 }}
        zIndex={2}
        bg="chart.bg"
        boxShadow="0 12px 32px rgba(0,0,0,.45)"
      >
        <Box minH={{ base: '240px', md: '280px' }} position="relative">
          <FrequencyChart
            series={visibleChartSeries}
            fMin={fMin}
            fMax={fMax}
            suggestions={state.suggestions}
            filterOverlays={showFilterOverlays ? filterOverlays : []}
            onAddCustomBand={state.addCustomBand}
          />
        </Box>

        <VerificationPanel state={state} />

        <ChartEqEditor state={state} />
      </Box>

      <ChartStatsGrid displayMeta={displayMeta} />
    </Card.Root>
  );
}

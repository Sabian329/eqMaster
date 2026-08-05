import type { RoomEqState } from '../../hooks/useRoomEq';

export interface ChartPanelProps {
  state: RoomEqState;
}

export interface ChartEqEditorProps {
  state: RoomEqState;
}

export interface FrequencyChartProps {
  series: import('../../types').ChartSeries[];
  fMin?: number;
  fMax?: number;
}

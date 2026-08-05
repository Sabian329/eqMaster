import type { ChannelMode } from '../../types';

export interface ConfigPanelProps {
  state: import('../../hooks/useRoomEq').RoomEqState;
}

export interface MeasurementActionsProps {
  state: import('../../hooks/useRoomEq').RoomEqState;
}

export type ChannelOption = { value: ChannelMode; label: string };

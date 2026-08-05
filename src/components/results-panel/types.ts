import type { RoomEqState } from '../../hooks/useRoomEq';

export interface ResultsPanelProps {
  state: RoomEqState;
}

export interface PresetExportCardProps {
  state: RoomEqState;
}

export interface ResultsEmptyStateProps {
  isTestMode: boolean;
}

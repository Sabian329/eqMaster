import type { Suggestion } from '../../types';

export interface EqBandBoardProps {
  suggestions: Suggestion[];
  setSuggestionQ: (key: string, q: number) => void;
  setSuggestionGain: (key: string, gain: number) => void;
  toggleSuggestionEnabled: (key: string) => void;
  embedded?: boolean;
}

export interface EqBandStripProps {
  item: Suggestion;
  index: number;
  setSuggestionQ: (key: string, q: number) => void;
  setSuggestionGain: (key: string, gain: number) => void;
  toggleSuggestionEnabled: (key: string) => void;
  compact?: boolean;
}

export interface BipolarGainFaderProps {
  value: number;
  onChange: (gain: number) => void;
  color: string;
  height: number;
  disabled?: boolean;
}

export interface QKnobProps {
  value: number;
  onChange: (value: number) => void;
  compact?: boolean;
}

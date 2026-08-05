import { Box } from '@chakra-ui/react';
import { EqBandBoard } from '../../eq-band-board';
import { EqToolbar } from './EqToolbar';
import type { ChartEqEditorProps } from '../types';

export function ChartEqEditor({ state }: ChartEqEditorProps) {
  const {
    curve,
    suggestions,
    setSuggestionQ,
    setSuggestionGain,
    toggleSuggestionEnabled,
    removeBand,
  } = state;

  if (!curve.length) return null;

  return (
    <Box borderTopWidth="1px" borderColor="whiteAlpha.150" bg="rgba(8,10,16,.92)">
      <EqBandBoard
        suggestions={suggestions}
        setSuggestionQ={setSuggestionQ}
        setSuggestionGain={setSuggestionGain}
        toggleSuggestionEnabled={toggleSuggestionEnabled}
        removeBand={removeBand}
        embedded
      />

      <EqToolbar state={state} />
    </Box>
  );
}

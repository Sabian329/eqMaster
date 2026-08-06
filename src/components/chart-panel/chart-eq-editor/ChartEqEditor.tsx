import { Box } from '@chakra-ui/react';
import { ui } from '../../../theme';
import { EqBandBoard } from '../../eq-band-board';
import { EqToolbar } from './EqToolbar';
import type { ChartEqEditorProps } from '../types';

export function ChartEqEditor({ state }: ChartEqEditorProps) {
  const {
    curve,
    suggestions,
    eqAlgorithmVersion,
    setSuggestionQ,
    setSuggestionGain,
    toggleSuggestionEnabled,
    removeBand,
  } = state;

  if (!curve.length || eqAlgorithmVersion === 'overview') return null;

  return (
    <Box borderTopWidth="1px" borderColor={ui.colors.border} bg={ui.colors.inset}>
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

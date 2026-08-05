import { Box, Text } from '@chakra-ui/react';
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
    eqSummary,
    activeToneProfile,
    isMockMeasurement,
  } = state;

  if (!curve.length) return null;

  return (
    <Box borderTopWidth="1px" borderColor="whiteAlpha.150" bg="rgba(8,10,16,.92)">
      <EqToolbar state={state} />

      <Text fontSize="2xs" color="gray.500" px={{ base: 3, md: 4 }} py={1.5} lineHeight="1.4">
        {eqSummary}
        {isMockMeasurement ? ' · mock data' : ''} · {activeToneProfile.label} on chart
      </Text>

      <EqBandBoard
        suggestions={suggestions}
        setSuggestionQ={setSuggestionQ}
        setSuggestionGain={setSuggestionGain}
        toggleSuggestionEnabled={toggleSuggestionEnabled}
        embedded
      />
    </Box>
  );
}

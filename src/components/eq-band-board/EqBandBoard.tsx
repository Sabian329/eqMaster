import { Box, Flex } from '@chakra-ui/react';
import { suggestionKey } from '../../utils/suggestionQ';
import { EqBandStrip } from './EqBandStrip';
import type { EqBandBoardProps } from './types';

export function EqBandBoard({
  suggestions,
  setSuggestionQ,
  setSuggestionGain,
  toggleSuggestionEnabled,
  removeCustomBand,
  embedded = false,
}: EqBandBoardProps) {
  if (!suggestions.length) {
    return (
      <Box p={6} color="gray.500" fontSize="sm" lineHeight="1.65">
        No auto-detected filters for this measurement. Click anywhere on the frequency chart
        above to add a custom band at that frequency.
      </Box>
    );
  }

  return (
    <Box
      overflowX="auto"
      overflowY="hidden"
      borderBottomWidth={embedded ? 0 : '1px'}
      borderColor="whiteAlpha.100"
      bg={embedded ? 'transparent' : 'rgba(8,10,16,.55)'}
      py={embedded ? 1 : 4}
      px={embedded ? 1 : 3}
    >
      <Flex
        gap={embedded ? 1.5 : 2}
        minW="min-content"
        align="stretch"
        justify="flex-start"
      >
        {suggestions.map((item, index) => (
          <EqBandStrip
            key={suggestionKey(item)}
            item={item}
            index={index}
            setSuggestionQ={setSuggestionQ}
            setSuggestionGain={setSuggestionGain}
            toggleSuggestionEnabled={toggleSuggestionEnabled}
            removeCustomBand={removeCustomBand}
            compact={embedded}
          />
        ))}
      </Flex>
    </Box>
  );
}

import { Box, Checkbox, HStack, IconButton, Stack, Text } from '@chakra-ui/react';
import { formatFrequency } from '../../utils/format';
import { isCustomSuggestion, suggestionKey } from '../../utils/suggestionQ';
import { BipolarGainFader } from './controls/BipolarGainFader';
import { QKnob } from './controls/QKnob';
import { BandSpeakerIcons } from './BandSpeakerIcons';
import { STRIP_LAYOUT } from './constants';
import type { EqBandStripProps } from './types';
import { bandColorForIndex, formatGainLabel, getFilterTypeLabel } from './utils';

export function EqBandStrip({
  item,
  index,
  setSuggestionQ,
  setSuggestionGain,
  toggleSuggestionEnabled,
  removeCustomBand,
  compact = false,
}: EqBandStripProps) {
  const rowKey = suggestionKey(item);
  const color = bandColorForIndex(index);
  const enabled = item.enabled !== false;
  const gain = item.gain ?? 0;
  const layout = compact ? STRIP_LAYOUT.compact : STRIP_LAYOUT.default;
  const isCustom = isCustomSuggestion(item);

  return (
    <Box
      flex={`0 0 ${layout.width}`}
      w={layout.width}
      p={layout.padding}
      borderRadius="lg"
      borderWidth="1px"
      borderColor={isCustom ? 'rgba(255,191,90,.35)' : 'whiteAlpha.150'}
      bg="rgba(12,16,24,.72)"
      opacity={enabled ? 1 : 0.72}
    >
      <Stack gap={layout.gap} align="center" h="full">
        <HStack w="full" justify="space-between" align="center">
          <Checkbox.Root
            checked={enabled}
            size="sm"
            onCheckedChange={() => toggleSuggestionEnabled(rowKey)}
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control borderColor="whiteAlpha.400" />
          </Checkbox.Root>
          {isCustom && removeCustomBand ? (
            <IconButton
              aria-label="Remove custom band"
              size="2xs"
              variant="ghost"
              color="gray.400"
              minW="18px"
              h="18px"
              _hover={{ color: 'red.300', bg: 'whiteAlpha.100' }}
              onClick={() => removeCustomBand(rowKey)}
            >
              ×
            </IconButton>
          ) : (
            <Box w="12px" h="12px" borderRadius="sm" bg={color} title="Band color" />
          )}
        </HStack>

        <BandSpeakerIcons color={color} opacity={enabled ? 0.92 : 0.35} />

        <Text
          fontSize="2xs"
          fontWeight="bold"
          color="gray.200"
          textAlign="center"
          lineHeight="1.2"
          minH={compact ? '22px' : '28px'}
        >
          {formatFrequency(item.frequency)}
        </Text>

        <Box h={`${layout.faderHeight}px`} w="full" px={0.5}>
          <BipolarGainFader
            value={enabled ? gain : 0}
            onChange={(nextGain) => setSuggestionGain(rowKey, nextGain)}
            color={color}
            height={layout.faderHeight}
            disabled={!enabled}
          />
        </Box>

        <Text
          fontSize="2xs"
          fontWeight="semibold"
          color={enabled ? 'gray.100' : 'gray.500'}
          fontVariantNumeric="tabular-nums"
          textAlign="center"
          minH="14px"
        >
          {formatGainLabel(item)}
        </Text>

        <QKnob
          value={item.q}
          onChange={(value) => setSuggestionQ(rowKey, value)}
          compact={compact}
        />

        <Text
          fontSize="2xs"
          color="gray.500"
          textAlign="center"
          lineHeight="1.35"
          minH={compact ? '24px' : '32px'}
          px={1}
        >
          {getFilterTypeLabel(item)}
        </Text>
      </Stack>
    </Box>
  );
}

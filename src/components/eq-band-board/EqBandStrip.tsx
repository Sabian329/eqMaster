import type { ReactNode } from 'react';
import { Box, Checkbox, HStack, IconButton, Stack, Text } from '@chakra-ui/react';
import { formatFrequency } from '../../utils/format';
import { isCustomSuggestion, suggestionKey } from '../../utils/suggestionQ';
import { BipolarGainFader } from './controls/BipolarGainFader';
import { QKnob } from './controls/QKnob';
import { BandSpeakerIcons } from './BandSpeakerIcons';
import { STRIP_CHROME, STRIP_LAYOUT } from './constants';
import type { EqBandStripProps } from './types';
import { bandColorForIndex, formatGainLabel, getFilterTypeLabel } from './utils';

function StripReadout({
  children,
  accent = false,
}: {
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <Box
      w="full"
      px={1}
      py={0.5}
      borderWidth="1px"
      borderColor={accent ? STRIP_CHROME.borderCustom : STRIP_CHROME.labelBorder}
      bg={STRIP_CHROME.labelBg}
      borderRadius="2px"
      textAlign="center"
    >
      {children}
    </Box>
  );
}

export function EqBandStrip({
  item,
  index,
  setSuggestionQ,
  setSuggestionGain,
  toggleSuggestionEnabled,
  removeBand,
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
      borderRadius="2px"
      borderWidth="1px"
      borderColor={isCustom ? STRIP_CHROME.borderCustom : STRIP_CHROME.border}
      bg={STRIP_CHROME.bg}
      opacity={enabled ? 1 : 0.65}
    >
      <Stack gap={layout.gap} align="center" h="full">
        <HStack w="full" justify="space-between" align="center">
          <Checkbox.Root
            checked={enabled}
            size="sm"
            onCheckedChange={() => toggleSuggestionEnabled(rowKey)}
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control
              borderColor={STRIP_CHROME.border}
              borderRadius="2px"
              _checked={{ bg: STRIP_CHROME.accent, borderColor: STRIP_CHROME.accent }}
            />
          </Checkbox.Root>
          <HStack gap={1} align="center">
            <Box
              w="10px"
              h="10px"
              borderRadius="0"
              bg={color}
              borderWidth="1px"
              borderColor="rgba(255,255,255,.15)"
              title="Band color"
              flexShrink={0}
            />
            {removeBand ? (
              <IconButton
                aria-label="Remove band"
                size="2xs"
                variant="ghost"
                color={STRIP_CHROME.textMuted}
                minW="16px"
                h="16px"
                borderRadius="2px"
                _hover={{ color: STRIP_CHROME.accent, bg: 'rgba(82,209,182,.08)' }}
                onClick={() => removeBand(rowKey)}
              >
                ×
              </IconButton>
            ) : null}
          </HStack>
        </HStack>

        <BandSpeakerIcons color={color} opacity={enabled ? 0.92 : 0.35} />

        <StripReadout>
          <Text
            fontSize="2xs"
            fontWeight="700"
            color={STRIP_CHROME.text}
            lineHeight="1.2"
            fontFamily="mono"
          >
            {formatFrequency(item.frequency)}
          </Text>
        </StripReadout>

        <Box h={`${layout.faderHeight}px`} w="full" px={0.5}>
          <BipolarGainFader
            value={enabled ? gain : 0}
            onChange={(nextGain) => setSuggestionGain(rowKey, nextGain)}
            color={color}
            height={layout.faderHeight}
            disabled={!enabled}
          />
        </Box>

        <StripReadout accent={enabled && gain !== 0}>
          <Text
            fontSize="2xs"
            fontWeight="700"
            color={enabled ? STRIP_CHROME.text : STRIP_CHROME.textMuted}
            fontVariantNumeric="tabular-nums"
            fontFamily="mono"
          >
            {formatGainLabel(item)}
          </Text>
        </StripReadout>

        <QKnob
          value={item.q}
          onChange={(value) => setSuggestionQ(rowKey, value)}
          compact={compact}
          accentColor={color}
        />

        <Text
          fontSize="2xs"
          color={STRIP_CHROME.textMuted}
          textAlign="center"
          lineHeight="1.2"
          minH={compact ? '20px' : '24px'}
          px={0.5}
          letterSpacing="0.04em"
          textTransform="uppercase"
        >
          {getFilterTypeLabel(item)}
        </Text>

        {item.safetyAdjusted ? (
          <Text
            fontSize="2xs"
            color={STRIP_CHROME.accent}
            textAlign="center"
            lineHeight="1.2"
            px={0.5}
            letterSpacing="0.03em"
          >
            Safety adjusted
          </Text>
        ) : null}
      </Stack>
    </Box>
  );
}

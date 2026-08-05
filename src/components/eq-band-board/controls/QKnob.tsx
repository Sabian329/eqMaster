import { Box, Slider, Stack, Text } from '@chakra-ui/react';
import {
  bandwidthOctavesToQ,
  compactNumber,
  qToBandwidthOctaves,
} from '../../../utils/format';
import {
  SUGGESTION_BW_OCT_MAX,
  SUGGESTION_BW_OCT_MIN,
} from '../../../utils/suggestionQ';
import { STRIP_CHROME } from '../constants';
import type { QKnobProps } from '../types';

export function QKnob({
  value,
  onChange,
  compact = false,
  accentColor = STRIP_CHROME.accent,
}: QKnobProps & { accentColor?: string }) {
  const bandwidthOctaves = qToBandwidthOctaves(value);
  const fraction =
    (bandwidthOctaves - SUGGESTION_BW_OCT_MIN) /
    (SUGGESTION_BW_OCT_MAX - SUGGESTION_BW_OCT_MIN);
  const angle = -135 + fraction * 270;
  const knobSize = compact ? '38px' : '48px';
  const pointerHeight = compact ? '12px' : '16px';

  return (
    <Stack gap={compact ? 1 : 1.5} align="center" w="full">
      <Box
        position="relative"
        w={knobSize}
        h={knobSize}
        borderRadius="2px"
        bg={STRIP_CHROME.labelBg}
        borderWidth="2px"
        borderColor={STRIP_CHROME.border}
        boxShadow="inset 0 0 0 1px rgba(0,0,0,.4)"
      >
        <Box
          position="absolute"
          inset={compact ? '4px' : '6px'}
          borderRadius="2px"
          bg={`conic-gradient(from ${angle}deg, ${accentColor} 0deg, rgba(82,209,182,.2) 110deg, transparent 110deg)`}
        />
        <Box
          position="absolute"
          top="50%"
          left="50%"
          w="2px"
          h={pointerHeight}
          bg="#0a0d12"
          borderRadius="0"
          transform={`translate(-50%, -100%) rotate(${angle}deg)`}
          transformOrigin="bottom center"
        />
      </Box>
      <Slider.Root
        min={SUGGESTION_BW_OCT_MIN}
        max={SUGGESTION_BW_OCT_MAX}
        step={0.01}
        value={[bandwidthOctaves]}
        onValueChange={(details) =>
          onChange(bandwidthOctavesToQ(details.value[0]))
        }
        size="sm"
        w="full"
      >
        <Slider.Control py={compact ? 0.5 : 1}>
          <Slider.Track bg={STRIP_CHROME.labelBg} h="3px" borderRadius="0">
            <Slider.Range bg={accentColor} />
          </Slider.Track>
          <Slider.Thumbs />
        </Slider.Control>
      </Slider.Root>
      <Text
        fontSize="2xs"
        color={STRIP_CHROME.textMuted}
        fontVariantNumeric="tabular-nums"
        fontFamily="mono"
      >
        Oct {compactNumber(bandwidthOctaves, 3)}
      </Text>
    </Stack>
  );
}

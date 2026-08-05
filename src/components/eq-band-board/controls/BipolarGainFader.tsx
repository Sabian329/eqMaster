import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import { GAIN_TICKS, STRIP_CHROME } from '../constants';
import type { BipolarGainFaderProps } from '../types';
import { gainToTopPercent, topPercentToGain } from '../utils';
import { clampBipolarGain } from '../../../utils/suggestionQ';

export function BipolarGainFader({
  value,
  onChange,
  color,
  height,
  disabled = false,
}: BipolarGainFaderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const gain = clampBipolarGain(value);
  const thumbTop = gainToTopPercent(gain);
  const centerTop = gainToTopPercent(0);
  const fillTop = Math.min(thumbTop, centerTop);
  const fillHeight = Math.abs(thumbTop - centerTop);

  const updateFromClientY = useCallback(
    (clientY: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const percent = ((clientY - rect.top) / rect.height) * 100;
      onChange(clampBipolarGain(Math.round(topPercentToGain(percent) * 10) / 10));
    },
    [onChange],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromClientY(event.clientY);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    updateFromClientY(event.clientY);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <Flex gap={1} align="center" justify="center" h={`${height}px`} w="full">
      <Stack gap={0} justify="space-between" h="full" py="1px" flexShrink={0}>
        {GAIN_TICKS.map((tick) => (
          <Text
            key={tick}
            fontSize="6px"
            color={STRIP_CHROME.textMuted}
            lineHeight="1"
            fontVariantNumeric="tabular-nums"
            fontFamily="mono"
            userSelect="none"
          >
            {tick > 0 ? `+${tick}` : tick}
          </Text>
        ))}
      </Stack>

      <Box
        ref={trackRef}
        position="relative"
        flex="1"
        maxW="12px"
        h="full"
        cursor={disabled ? 'default' : 'ns-resize'}
        touchAction="none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {GAIN_TICKS.map((tick) => (
          <Box
            key={tick}
            position="absolute"
            left="-2px"
            right="-2px"
            top={`${gainToTopPercent(tick)}%`}
            transform="translateY(-50%)"
            pointerEvents="none"
          >
            <Box
              h="1px"
              bg={tick === 0 ? STRIP_CHROME.borderCustom : STRIP_CHROME.border}
              w="full"
            />
          </Box>
        ))}

        <Box
          position="absolute"
          inset="0"
          borderRadius="2px"
          bg={STRIP_CHROME.labelBg}
          borderWidth="1px"
          borderColor={STRIP_CHROME.border}
          pointerEvents="none"
        />

        {!disabled && fillHeight > 0.5 && (
          <Box
            position="absolute"
            left="1px"
            right="1px"
            top={`${fillTop}%`}
            h={`${fillHeight}%`}
            borderRadius="1px"
            bg={color}
            opacity={0.95}
            pointerEvents="none"
          />
        )}

        {!disabled && (
          <Box
            position="absolute"
            left="50%"
            top={`${thumbTop}%`}
            transform="translate(-50%, -50%)"
            w="12px"
            h="10px"
            borderRadius="2px"
            bg="#1a1f28"
            borderWidth="2px"
            borderColor={color}
            boxShadow="none"
            pointerEvents="none"
            zIndex={2}
          >
            <Box
              position="absolute"
              top="50%"
              left="1px"
              right="1px"
              h="1px"
              bg={color}
              transform="translateY(-50%)"
            />
          </Box>
        )}
      </Box>

      <Stack gap={0} justify="space-between" h="full" py="1px" flexShrink={0}>
        {GAIN_TICKS.map((tick) => (
          <Box
            key={`r-${tick}`}
            w="4px"
            h="1px"
            bg={tick === 0 ? STRIP_CHROME.borderCustom : STRIP_CHROME.border}
            alignSelf="flex-end"
          />
        ))}
      </Stack>
    </Flex>
  );
}

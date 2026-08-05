import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import { GAIN_TICKS } from '../constants';
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
            color="gray.600"
            lineHeight="1"
            fontVariantNumeric="tabular-nums"
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
        maxW="14px"
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
            left="-3px"
            right="-3px"
            top={`${gainToTopPercent(tick)}%`}
            transform="translateY(-50%)"
            pointerEvents="none"
          >
            <Box
              h="1px"
              bg={tick === 0 ? 'whiteAlpha.500' : 'whiteAlpha.250'}
              w="full"
            />
          </Box>
        ))}

        <Box
          position="absolute"
          inset="0"
          borderRadius="full"
          bg="whiteAlpha.120"
          borderWidth="1px"
          borderColor="whiteAlpha.200"
          pointerEvents="none"
        />

        {!disabled && fillHeight > 0.5 && (
          <Box
            position="absolute"
            left="2px"
            right="2px"
            top={`${fillTop}%`}
            h={`${fillHeight}%`}
            borderRadius="full"
            bg={color}
            opacity={0.92}
            pointerEvents="none"
          />
        )}

        {!disabled && (
          <Box
            position="absolute"
            left="50%"
            top={`${thumbTop}%`}
            transform="translate(-50%, -50%)"
            w="14px"
            h="14px"
            borderRadius="full"
            bg="gray.100"
            borderWidth="2px"
            borderColor={color}
            boxShadow="0 2px 6px rgba(0,0,0,.45)"
            pointerEvents="none"
            zIndex={2}
          />
        )}
      </Box>

      <Stack gap={0} justify="space-between" h="full" py="1px" flexShrink={0}>
        {GAIN_TICKS.map((tick) => (
          <Box
            key={`r-${tick}`}
            w="5px"
            h="1px"
            bg={tick === 0 ? 'whiteAlpha.500' : 'whiteAlpha.250'}
            alignSelf="flex-end"
          />
        ))}
      </Stack>
    </Flex>
  );
}

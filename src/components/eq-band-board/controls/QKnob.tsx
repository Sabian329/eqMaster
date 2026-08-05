import { Box, Slider, Stack, Text } from '@chakra-ui/react';
import { SUGGESTION_Q_MAX, SUGGESTION_Q_MIN } from '../../../utils/suggestionQ';
import type { QKnobProps } from '../types';

export function QKnob({ value, onChange, compact = false }: QKnobProps) {
  const fraction = (value - SUGGESTION_Q_MIN) / (SUGGESTION_Q_MAX - SUGGESTION_Q_MIN);
  const angle = -135 + fraction * 270;
  const knobSize = compact ? '40px' : '52px';
  const pointerHeight = compact ? '14px' : '18px';

  return (
    <Stack gap={compact ? 1 : 2} align="center" w="full">
      <Box
        position="relative"
        w={knobSize}
        h={knobSize}
        borderRadius="full"
        bg="surface.inset"
        borderWidth="2px"
        borderColor="whiteAlpha.200"
        boxShadow="inset 0 2px 8px rgba(0,0,0,.35)"
      >
        <Box
          position="absolute"
          inset={compact ? '5px' : '7px'}
          borderRadius="full"
          bg={`conic-gradient(from ${angle}deg, rgba(82,209,182,.95) 0deg, rgba(82,209,182,.25) 110deg, transparent 110deg)`}
        />
        <Box
          position="absolute"
          top="50%"
          left="50%"
          w="2px"
          h={pointerHeight}
          bg="teal.200"
          borderRadius="full"
          transform={`translate(-50%, -100%) rotate(${angle}deg)`}
          transformOrigin="bottom center"
        />
      </Box>
      <Slider.Root
        min={SUGGESTION_Q_MIN}
        max={SUGGESTION_Q_MAX}
        step={0.05}
        value={[value]}
        onValueChange={(details) => onChange(details.value[0])}
        size="sm"
        w="full"
      >
        <Slider.Control py={compact ? 0.5 : 1}>
          <Slider.Track bg="whiteAlpha.300" h="4px">
            <Slider.Range bg="teal.400" />
          </Slider.Track>
          <Slider.Thumbs />
        </Slider.Control>
      </Slider.Root>
      <Text fontSize="2xs" color="gray.400" fontVariantNumeric="tabular-nums">
        Q: {value.toFixed(2)}
      </Text>
    </Stack>
  );
}

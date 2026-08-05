import { HStack, Slider, Stack, Text } from '@chakra-ui/react';
import { sliderStyles } from '../../theme';

interface LevelSliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  minLabel?: string;
  maxLabel?: string;
}

export function LevelSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  minLabel,
  maxLabel,
}: LevelSliderProps) {
  return (
    <Stack gap={2}>
      <Slider.Root
        w="full"
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(details) => onChange(details.value[0])}
      >
        <Slider.Control py={3} w="full">
          <Slider.Track {...sliderStyles.track}>
            <Slider.Range {...sliderStyles.range} />
          </Slider.Track>
          <Slider.Thumbs>
            <Slider.Thumb {...sliderStyles.thumb} index={0} />
          </Slider.Thumbs>
        </Slider.Control>
      </Slider.Root>
      {(minLabel || maxLabel) && (
        <HStack justify="space-between">
          {minLabel ? (
            <Text {...sliderStyles.tickLabel}>{minLabel}</Text>
          ) : (
            <span />
          )}
          {maxLabel ? <Text {...sliderStyles.tickLabel}>{maxLabel}</Text> : null}
        </HStack>
      )}
    </Stack>
  );
}

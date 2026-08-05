import {
  Button,
  Field,
  Flex,
  Grid,
  HStack,
  Input,
  NativeSelect,
  Slider,
  Text,
} from '@chakra-ui/react';
import type { EqBandCount, ToneProfileId } from '../../../config/toneProfiles';
import type { RoomEqState } from '../../../hooks/useRoomEq';
import { SUGGESTION_Q_MAX, SUGGESTION_Q_MIN } from '../../../utils/suggestionQ';
import { buttonStyles, fieldStyles } from '../../../theme';

interface EqToolbarProps {
  state: Pick<
    RoomEqState,
    | 'globalBandQ'
    | 'setAllSuggestionQ'
    | 'scaleAllSuggestionQ'
    | 'resetSuggestionQ'
    | 'eqBandCount'
    | 'setEqBandCount'
    | 'eqBandOptions'
    | 'toneProfileId'
    | 'setToneProfileId'
    | 'toneProfiles'
    | 'presetPreamp'
    | 'setPresetPreamp'
  >;
}

export function EqToolbar({ state }: EqToolbarProps) {
  const {
    globalBandQ,
    setAllSuggestionQ,
    scaleAllSuggestionQ,
    resetSuggestionQ,
    eqBandCount,
    setEqBandCount,
    eqBandOptions,
    toneProfileId,
    setToneProfileId,
    toneProfiles,
    presetPreamp,
    setPresetPreamp,
  } = state;

  return (
    <Grid
      px={{ base: 3, md: 4 }}
      py={2}
      gap={2}
      alignItems="end"
      templateColumns={{
        base: '1fr',
        lg: 'minmax(0,1fr) minmax(0,0.65fr) minmax(0,1.1fr) minmax(0,1fr)',
      }}
      borderBottomWidth="1px"
      borderColor="whiteAlpha.100"
      bg="rgba(12,16,24,.95)"
    >
      <Field.Root>
        <Field.Label {...fieldStyles.label} mb={1} fontSize="2xs">
          Tone target
        </Field.Label>
        <NativeSelect.Root size="sm">
          <NativeSelect.Field
            {...fieldStyles.control}
            value={toneProfileId}
            onChange={(e) => setToneProfileId(e.target.value as ToneProfileId)}
          >
            {toneProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.label}
              </option>
            ))}
          </NativeSelect.Field>
        </NativeSelect.Root>
      </Field.Root>

      <Field.Root>
        <Field.Label {...fieldStyles.label} mb={1} fontSize="2xs">
          Max bands
        </Field.Label>
        <NativeSelect.Root size="sm">
          <NativeSelect.Field
            {...fieldStyles.control}
            value={eqBandCount}
            onChange={(e) => setEqBandCount(Number(e.target.value) as EqBandCount)}
          >
            {eqBandOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect.Field>
        </NativeSelect.Root>
      </Field.Root>

      <Field.Root>
        <Flex justify="space-between" align="center" mb={1}>
          <Field.Label {...fieldStyles.label} mb={0} fontSize="2xs">
            All bands Q
          </Field.Label>
          <Text fontSize="2xs" color="gray.500">
            {globalBandQ.toFixed(2)}
          </Text>
        </Flex>
        <HStack gap={1.5}>
          <Slider.Root
            flex={1}
            min={SUGGESTION_Q_MIN}
            max={SUGGESTION_Q_MAX}
            step={0.05}
            value={[globalBandQ]}
            onValueChange={(details) => setAllSuggestionQ(details.value[0])}
            size="sm"
          >
            <Slider.Control py={0.5}>
              <Slider.Track bg="whiteAlpha.300">
                <Slider.Range bg="brand.400" />
              </Slider.Track>
              <Slider.Thumbs />
            </Slider.Control>
          </Slider.Root>
          <Button size="xs" borderRadius="md" {...buttonStyles.secondary} onClick={resetSuggestionQ}>
            Auto
          </Button>
          <Button
            size="xs"
            borderRadius="md"
            {...buttonStyles.secondary}
            onClick={() => scaleAllSuggestionQ(0.7)}
          >
            Softer
          </Button>
          <Button
            size="xs"
            borderRadius="md"
            {...buttonStyles.secondary}
            onClick={() => scaleAllSuggestionQ(1.3)}
          >
            Sharp
          </Button>
        </HStack>
      </Field.Root>

      <Field.Root>
        <Flex justify="space-between" align="center" mb={1}>
          <Field.Label {...fieldStyles.label} mb={0} fontSize="2xs">
            Preamp
          </Field.Label>
          <Text fontSize="2xs" color="gray.400" fontVariantNumeric="tabular-nums">
            {presetPreamp.toFixed(1)} dB
          </Text>
        </Flex>
        <HStack gap={2}>
          <Slider.Root
            flex={1}
            min={-30}
            max={12}
            step={0.1}
            value={[presetPreamp]}
            onValueChange={(details) => setPresetPreamp(details.value[0])}
            size="sm"
          >
            <Slider.Control py={0.5}>
              <Slider.Track bg="whiteAlpha.300">
                <Slider.Range bg="brand.400" />
              </Slider.Track>
              <Slider.Thumbs />
            </Slider.Control>
          </Slider.Root>
          <Input
            type="number"
            size="sm"
            min={-30}
            max={12}
            step={0.1}
            value={presetPreamp}
            w="68px"
            {...fieldStyles.control}
            onChange={(e) => setPresetPreamp(Number(e.target.value))}
          />
        </HStack>
      </Field.Root>
    </Grid>
  );
}

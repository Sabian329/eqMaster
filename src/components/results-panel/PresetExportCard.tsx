import {
  Badge,
  Box,
  Button,
  Code,
  Field,
  Flex,
  Grid,
  Heading,
  Input,
  Text,
  Textarea,
} from '@chakra-ui/react';
import { badgeStyles, buttonStyles, fieldStyles, ui } from '../../theme';
import type { PresetExportCardProps } from './types';

export function PresetExportCard({ state }: PresetExportCardProps) {
  const {
    presetName,
    setPresetName,
    presetText,
    presetStatus,
    copyPreset,
    exportPresetTxt,
    measurementRuns,
    averagedRun,
    isMockMeasurement,
  } = state;

  return (
    <Box
      p={4}
      borderRadius="2px"
      borderWidth="1px"
      borderColor={ui.colors.border}
      bg={ui.colors.inset}
    >
      <Heading
        size="sm"
        mb={2}
        color={ui.colors.text}
        letterSpacing="0.06em"
        textTransform="uppercase"
        fontSize="xs"
      >
        Text preset for your equalizer
      </Heading>
      {isMockMeasurement ? (
        <Text fontSize="2xs" color={ui.colors.accent} lineHeight="1.6" mb={3} fontFamily={ui.fonts.mono}>
          Mock measurement{measurementRuns.length > 1 ? `s (${measurementRuns.length} averaged)` : ''}{' '}
          — preset updates live from the EQ panel under the chart.
        </Text>
      ) : (
        measurementRuns.length > 1 &&
        averagedRun && (
          <Text fontSize="2xs" color={ui.colors.accent} lineHeight="1.6" mb={3} fontFamily={ui.fonts.mono}>
            Based on {measurementRuns.length} averaged measurements and a flat reference target.
          </Text>
        )
      )}
      <Text fontSize="2xs" color={ui.colors.textMuted} lineHeight="1.6" mb={4}>
        Format:{' '}
        <Code
          px={1.5}
          py={0.5}
          borderRadius="2px"
          bg={ui.colors.bg}
          borderWidth="1px"
          borderColor={ui.colors.border}
          color={ui.colors.text}
          fontFamily={ui.fonts.mono}
          fontSize="2xs"
        >
          Name / Preamp / Filter / PK / Fc / Gain / BW Oct
        </Code>
        . Nulls export as <strong>OFF</strong>.
      </Text>

      <Grid templateColumns={{ base: '1fr', md: '1fr' }} gap={3}>
        <Field.Root>
          <Field.Label {...fieldStyles.label}>Preset name</Field.Label>
          <Input
            value={presetName}
            maxLength={120}
            {...fieldStyles.control}
            onChange={(e) => setPresetName(e.target.value)}
          />
          <Field.HelperText {...fieldStyles.helper}>
            Auto-updates from algorithm, smoothing, and measurement date.
          </Field.HelperText>
        </Field.Root>
      </Grid>

      <Field.Root mt={4}>
        <Field.Label {...fieldStyles.label}>Generated text</Field.Label>
        <Textarea
          readOnly
          spellCheck={false}
          value={presetText}
          minH="260px"
          lineHeight="1.65"
          {...fieldStyles.control}
        />
      </Field.Root>

      <Flex mt={4} gap={2} flexWrap="wrap" align="center">
        <Button
          size="sm"
          borderRadius="2px"
          {...buttonStyles.primary}
          onClick={() => void copyPreset()}
        >
          Copy preset
        </Button>
        <Button size="sm" borderRadius="2px" {...buttonStyles.secondary} onClick={exportPresetTxt}>
          Download TXT
        </Button>
        {presetStatus && <Badge {...badgeStyles.info}>{presetStatus}</Badge>}
      </Flex>
    </Box>
  );
}

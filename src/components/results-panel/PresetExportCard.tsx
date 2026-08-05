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
import { badgeStyles, buttonStyles, fieldStyles } from '../../theme';
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
      borderRadius="xl"
      borderWidth="1px"
      borderColor="whiteAlpha.100"
      bg="whiteAlpha.40"
    >
      <Heading size="sm" mb={2} color="gray.100">
        Text preset for your equalizer
      </Heading>
      {isMockMeasurement ? (
        <Text fontSize="xs" color="brand.200" lineHeight="1.6" mb={3}>
          Mock measurement{measurementRuns.length > 1 ? `s (${measurementRuns.length} averaged)` : ''}{' '}
          — preset updates live from the EQ panel under the chart.
        </Text>
      ) : (
        measurementRuns.length > 1 &&
        averagedRun && (
          <Text fontSize="xs" color="brand.200" lineHeight="1.6" mb={3}>
            Based on {measurementRuns.length} averaged measurements and a flat reference target.
          </Text>
        )
      )}
      <Text fontSize="xs" color="gray.500" lineHeight="1.6" mb={4}>
        Format:{' '}
        <Code
          px={1.5}
          py={0.5}
          borderRadius="md"
          bg="blackAlpha.400"
          borderWidth="1px"
          borderColor="whiteAlpha.200"
          color="gray.200"
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
            maxLength={80}
            {...fieldStyles.control}
            onChange={(e) => setPresetName(e.target.value)}
          />
        </Field.Root>
      </Grid>

      <Field.Root mt={4}>
        <Field.Label {...fieldStyles.label}>Generated text</Field.Label>
        <Textarea
          readOnly
          spellCheck={false}
          value={presetText}
          minH="260px"
          fontFamily="mono"
          fontSize="sm"
          lineHeight="1.65"
          {...fieldStyles.control}
        />
      </Field.Root>

      <Flex mt={4} gap={2} flexWrap="wrap" align="center">
        <Button
          size="sm"
          borderRadius="lg"
          {...buttonStyles.primary}
          onClick={() => void copyPreset()}
        >
          Copy preset
        </Button>
        <Button size="sm" borderRadius="lg" {...buttonStyles.secondary} onClick={exportPresetTxt}>
          Download TXT
        </Button>
        {presetStatus && <Badge {...badgeStyles.info}>{presetStatus}</Badge>}
      </Flex>
    </Box>
  );
}

import { useEffect, useRef } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Code,
  Field,
  Flex,
  Grid,
  Heading,
  HStack,
  Input,
  Table,
  Text,
  Textarea,
} from '@chakra-ui/react';
import type { RoomEqState } from '../hooks/useRoomEq';
import { formatDb, formatFrequency } from '../utils/format';
import {
  badgeStyles,
  buttonStyles,
  fieldStyles,
  panelStyles,
} from '../theme';

interface ResultsPanelProps {
  state: RoomEqState;
}

function SuggestionBadge({ kind }: { kind: 'cut' | 'boost' | 'null' }) {
  const styles =
    kind === 'cut'
      ? { bg: 'rgba(101,169,255,.18)', color: '#9fc9ff', label: 'Peak' }
      : kind === 'boost'
        ? { bg: 'rgba(85,214,139,.16)', color: '#a5edc3', label: 'Dip' }
        : { bg: 'rgba(255,191,90,.16)', color: '#ffd28c', label: 'Possible null' };

  return (
    <Badge
      px={2}
      py={0.5}
      borderRadius="full"
      fontSize="2xs"
      fontWeight="bold"
      bg={styles.bg}
      color={styles.color}
    >
      {styles.label}
    </Badge>
  );
}

export function ResultsPanel({ state }: ResultsPanelProps) {
  const {
    curve,
    suggestions,
    presetName,
    setPresetName,
    presetPreamp,
    setPresetPreamp,
    presetText,
    presetStatus,
    exportCsv,
    exportJson,
    copyPreset,
    exportPresetTxt,
    measurementRuns,
    averagedRun,
  } = state;

  const sectionRef = useRef<HTMLDivElement>(null);
  const prevCurveLen = useRef(0);

  useEffect(() => {
    if (curve.length > 0 && prevCurveLen.current === 0) {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    prevCurveLen.current = curve.length;
  }, [curve.length]);

  if (!curve.length) {
    return (
      <Card.Root ref={sectionRef} w="full" {...panelStyles.root}>
        <Card.Header {...panelStyles.header}>
          <Heading size="md" fontWeight="semibold" color="gray.100">
            Analysis & EQ suggestions
          </Heading>
        </Card.Header>
        <Card.Body {...panelStyles.body}>
          <Text fontSize="sm" color="gray.500" lineHeight="1.65">
            Run a measurement to see peak/dip suggestions, export options, and a text preset
            for your equalizer.
          </Text>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <Card.Root ref={sectionRef} w="full" {...panelStyles.root}>
      <Card.Header {...panelStyles.header}>
        <Flex justify="space-between" align="center" gap={4} flexWrap="wrap">
          <Heading size="md" fontWeight="semibold" color="gray.100">
            Starting points for manual EQ
          </Heading>
          <HStack gap={2}>
            <Button size="sm" borderRadius="lg" {...buttonStyles.secondary} onClick={exportCsv}>
              Export CSV
            </Button>
            <Button size="sm" borderRadius="lg" {...buttonStyles.secondary} onClick={exportJson}>
              Export JSON
            </Button>
          </HStack>
        </Flex>
      </Card.Header>

      <Box overflowX="auto" borderBottomWidth="1px" borderColor="whiteAlpha.100">
        <Table.Root size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader color="gray.500">Type</Table.ColumnHeader>
              <Table.ColumnHeader color="gray.500">Frequency</Table.ColumnHeader>
              <Table.ColumnHeader color="gray.500">Deviation</Table.ColumnHeader>
              <Table.ColumnHeader color="gray.500">Suggestion</Table.ColumnHeader>
              <Table.ColumnHeader color="gray.500">Approx. Q</Table.ColumnHeader>
              <Table.ColumnHeader color="gray.500" minW="260px">
                Notes
              </Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {!suggestions.length ? (
              <Table.Row>
                <Table.Cell colSpan={6} color="gray.500" whiteSpace="normal" py={5}>
                  No clear local peaks or dips exceeded the suggestion thresholds. Review the
                  chart and consider running a longer measurement.
                </Table.Cell>
              </Table.Row>
            ) : (
              suggestions.map((item) => {
                let suggestionText = '';
                if (item.kind === 'cut') {
                  suggestionText = `${item.gain!.toFixed(1)} dB`;
                } else if (item.kind === 'boost') {
                  suggestionText = `+${item.gain!.toFixed(1)} dB max`;
                } else {
                  suggestionText = 'Do not boost';
                }

                return (
                  <Table.Row key={`${item.kind}-${item.frequency}`}>
                    <Table.Cell>
                      <SuggestionBadge kind={item.kind} />
                    </Table.Cell>
                    <Table.Cell color="gray.100" fontVariantNumeric="tabular-nums">
                      {formatFrequency(item.frequency)}
                    </Table.Cell>
                    <Table.Cell color="gray.100" fontVariantNumeric="tabular-nums">
                      {formatDb(item.deviation)}
                    </Table.Cell>
                    <Table.Cell color="gray.100">{suggestionText}</Table.Cell>
                    <Table.Cell color="gray.100" fontVariantNumeric="tabular-nums">
                      {item.q.toFixed(2)}
                    </Table.Cell>
                    <Table.Cell color="gray.500" whiteSpace="normal">
                      {item.note}
                    </Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table.Root>
      </Box>

      <Card.Body {...panelStyles.body}>
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
          {measurementRuns.length > 1 && averagedRun && (
            <Text fontSize="xs" color="brand.200" lineHeight="1.6" mb={3}>
              EQ suggestions below are based on the averaged curve from{' '}
              {measurementRuns.length} measurements. Individual runs are shown on the chart.
            </Text>
          )}
          <Text fontSize="xs" color="gray.500" lineHeight="1.6" mb={4}>
            Format matches the example:{' '}
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
            . Likely nulls are saved as <strong>OFF</strong> because boosting them usually does
            not help.
          </Text>

          <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={3}>
            <Field.Root>
              <Field.Label {...fieldStyles.label}>Preset name</Field.Label>
              <Input
                value={presetName}
                maxLength={80}
                {...fieldStyles.control}
                onChange={(e) => setPresetName(e.target.value)}
              />
            </Field.Root>
            <Field.Root>
              <Field.Label {...fieldStyles.label}>Preamp [dB]</Field.Label>
              <Input
                type="number"
                value={presetPreamp}
                min={-30}
                max={12}
                step={0.1}
                {...fieldStyles.control}
                onChange={(e) => setPresetPreamp(Number(e.target.value))}
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
            <Button size="sm" borderRadius="lg" {...buttonStyles.primary} onClick={() => void copyPreset()}>
              Copy preset
            </Button>
            <Button size="sm" borderRadius="lg" {...buttonStyles.secondary} onClick={exportPresetTxt}>
              Download TXT
            </Button>
            {presetStatus && (
              <Badge {...badgeStyles.info}>{presetStatus}</Badge>
            )}
          </Flex>
        </Box>

        <Text fontSize="xs" color="gray.500" lineHeight="1.65" mt={4}>
          Suggestions are a starting point, not automatic calibration. Cut wide peaks first. Deep
          dips are often caused by room cancellation and usually should not be heavily boosted with
          EQ. Re-measure after each change.
        </Text>
      </Card.Body>
    </Card.Root>
  );
}

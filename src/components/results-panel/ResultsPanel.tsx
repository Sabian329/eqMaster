import { useEffect, useRef } from 'react';
import { Button, Card, Flex, Heading, HStack, Stack, Text } from '@chakra-ui/react';
import { buttonStyles, panelStyles, ui } from '../../theme';
import { PresetExportCard } from './PresetExportCard';
import { ResultsEmptyState } from './ResultsEmptyState';
import type { ResultsPanelProps } from './types';

export function ResultsPanel({ state }: ResultsPanelProps) {
  const { curve, exportCsv, exportJson, isTestMode } = state;

  const sectionRef = useRef<HTMLDivElement>(null);
  const prevCurveLen = useRef(0);

  useEffect(() => {
    if (curve.length > 0 && prevCurveLen.current === 0) {
      document
        .getElementById('frequency-chart-panel')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    prevCurveLen.current = curve.length;
  }, [curve.length]);

  if (!curve.length) {
    return (
      <div ref={sectionRef}>
        <ResultsEmptyState isTestMode={isTestMode} />
      </div>
    );
  }

  return (
    <Card.Root ref={sectionRef} w="full" {...panelStyles.root}>
      <Card.Header {...panelStyles.header}>
        <Flex justify="space-between" align="center" gap={4} flexWrap="wrap">
          <Stack gap={1}>
            <Heading size="sm" fontWeight="700" color={ui.colors.text} letterSpacing="0.04em" textTransform="uppercase">
              Export & preset
            </Heading>
            <Text fontSize="2xs" color={ui.colors.textMuted} lineHeight="1.6">
              EQ editing is directly under the frequency chart above.
            </Text>
          </Stack>
          <HStack gap={2}>
            <Button size="sm" borderRadius="2px" {...buttonStyles.secondary} onClick={exportCsv}>
              Export CSV
            </Button>
            <Button size="sm" borderRadius="2px" {...buttonStyles.secondary} onClick={exportJson}>
              Export JSON
            </Button>
          </HStack>
        </Flex>
      </Card.Header>

      <Card.Body {...panelStyles.body}>
        <PresetExportCard state={state} />

        <Text fontSize="xs" color="gray.500" lineHeight="1.65" mt={4}>
          Suggestions are a starting point, not automatic calibration. Adjust gain and Q under
          the chart — orange After EQ updates live; use Verify correction for a real re-measurement
          with EQ on the sweep.
        </Text>
      </Card.Body>
    </Card.Root>
  );
}

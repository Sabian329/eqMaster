import { Card, Heading, Text } from '@chakra-ui/react';
import { panelStyles } from '../../theme';
import type { ResultsEmptyStateProps } from './types';

export function ResultsEmptyState({ isTestMode }: ResultsEmptyStateProps) {
  return (
    <Card.Root w="full" {...panelStyles.root}>
      <Card.Header {...panelStyles.header}>
        <Heading size="md" fontWeight="semibold" color="gray.100">
          Export & preset
        </Heading>
      </Card.Header>
      <Card.Body {...panelStyles.body}>
        <Text fontSize="sm" color="gray.500" lineHeight="1.65">
          {isTestMode
            ? 'Open the Test tab to load mock measurement data, or run a test measurement session.'
            : 'Run a measurement to edit EQ under the chart and export a preset here.'}
        </Text>
      </Card.Body>
    </Card.Root>
  );
}

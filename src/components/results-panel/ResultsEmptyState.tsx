import { Card, Heading, Text } from '@chakra-ui/react';
import { panelStyles } from '../../theme';

export function ResultsEmptyState() {
  return (
    <Card.Root w="full" {...panelStyles.root}>
      <Card.Header {...panelStyles.header}>
        <Heading size="md" fontWeight="semibold" color="gray.100">
          Export & preset
        </Heading>
      </Card.Header>
      <Card.Body {...panelStyles.body}>
        <Text fontSize="sm" color="gray.500" lineHeight="1.65">
          Run a measurement to edit EQ under the chart and export a preset here.
        </Text>
      </Card.Body>
    </Card.Root>
  );
}

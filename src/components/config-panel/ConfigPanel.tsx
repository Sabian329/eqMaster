import {
  Badge,
  Box,
  Card,
  Flex,
  Heading,
  Stack,
  Tabs,
  Text,
} from '@chakra-ui/react';
import type { SetupMode } from '../../types';
import { panelStyles, tabStyles } from '../../theme';
import { AdvancedSetupFields } from '../advanced-setup';
import { MeasurementActions } from './MeasurementActions';
import type { ConfigPanelProps } from './types';

const MODE_META = {
  live: {
    label: 'Live measurement',
    description: 'Real microphone and speaker hardware',
    accent: '#65a9ff',
  },
  test: {
    label: 'Test bench',
    description: 'Synthetic response — no audio I/O',
    accent: '#ffbf5a',
  },
} as const;

export function ConfigPanel({ state }: ConfigPanelProps) {
  const { setupMode, setSetupMode } = state;
  const modeMeta = MODE_META[setupMode];

  return (
    <Card.Root w="full" {...panelStyles.root}>
      <Card.Header {...panelStyles.header}>
        <Flex justify="space-between" align="flex-start" gap={4} flexWrap="wrap">
          <Stack gap={1} flex="1 1 280px">
            <Heading size="md" fontWeight="semibold" color="gray.100" letterSpacing="-0.02em">
              Measurement setup
            </Heading>
            <Text fontSize="sm" color="gray.500" lineHeight="1.55" maxW="560px">
              Configure profile, routing, sweep, and levels — then launch a session from the
              panel below.
            </Text>
          </Stack>
          <Badge
            px={3}
            py={1.5}
            borderRadius="full"
            fontSize="xs"
            fontWeight="semibold"
            borderWidth="1px"
            borderColor={`${modeMeta.accent}55`}
            bg={`${modeMeta.accent}18`}
            color={modeMeta.accent}
          >
            {modeMeta.label}
          </Badge>
        </Flex>
      </Card.Header>

      <Card.Body {...panelStyles.body} p={{ base: 4, md: 6 }}>
        <Stack gap={6}>
          <Tabs.Root
            value={setupMode}
            onValueChange={(details) => setSetupMode(details.value as SetupMode)}
            variant="enclosed"
          >
            <Stack gap={1.5} mb={1}>
              <Tabs.List {...tabStyles.list} maxW="360px">
                <Tabs.Trigger value="live" {...tabStyles.trigger} flex={1}>
                  Live
                </Tabs.Trigger>
                <Tabs.Trigger value="test" {...tabStyles.trigger} flex={1}>
                  Test
                </Tabs.Trigger>
              </Tabs.List>
              <Text fontSize="xs" color="gray.600" pl={0.5}>
                {modeMeta.description}
              </Text>
            </Stack>

            <Tabs.Content value="live" pt={2}>
              <AdvancedSetupFields state={state} />
            </Tabs.Content>

            <Tabs.Content value="test" pt={2}>
              <AdvancedSetupFields state={state} isTestMode />
            </Tabs.Content>
          </Tabs.Root>

          <Box h="1px" bg="linear-gradient(90deg, transparent, whiteAlpha.200, transparent)" />

          <MeasurementActions state={state} />
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}

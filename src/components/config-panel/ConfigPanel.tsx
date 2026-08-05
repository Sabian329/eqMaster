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
import { panelStyles, tabStyles, ui } from '../../theme';
import { AdvancedSetupFields } from '../advanced-setup';
import { MeasurementActions } from './MeasurementActions';
import type { ConfigPanelProps } from './types';

const MODE_META = {
  live: {
    label: 'Live measurement',
    description: 'Real microphone and speaker hardware',
    accent: ui.colors.accent,
  },
  test: {
    label: 'Test bench',
    description: 'Synthetic response — no audio I/O',
    accent: ui.colors.warn,
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
            <Heading size="sm" fontWeight="700" color={ui.colors.text} letterSpacing="0.04em" textTransform="uppercase">
              Measurement setup
            </Heading>
            <Text fontSize="2xs" color={ui.colors.textMuted} lineHeight="1.55" maxW="560px">
              Configure profile, routing, sweep, and levels — then launch a session from the
              panel below.
            </Text>
          </Stack>
          <Badge
            px={2.5}
            py={1}
            borderRadius="2px"
            fontSize="2xs"
            fontWeight="700"
            letterSpacing="0.06em"
            textTransform="uppercase"
            borderWidth="1px"
            borderColor={`${modeMeta.accent}66`}
            bg={`${modeMeta.accent}12`}
            color={modeMeta.accent}
            fontFamily={ui.fonts.mono}
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
              <Text fontSize="2xs" color={ui.colors.textDim} pl={0.5} fontFamily={ui.fonts.mono}>
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

          <Box h="1px" bg={ui.colors.border} />

          <MeasurementActions state={state} />
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}

import {
  Box,
  Card,
  Heading,
  Separator,
  Stack,
  Tabs,
} from '@chakra-ui/react';
import type { SetupMode } from '../../types';
import { panelStyles, tabStyles } from '../../theme';
import { AdvancedSetupFields } from '../advanced-setup';
import { MeasurementActions } from './MeasurementActions';
import { SimpleSetupTab } from './SimpleSetupTab';
import type { ConfigPanelProps } from './types';

export function ConfigPanel({ state }: ConfigPanelProps) {
  const { setupMode, setSetupMode } = state;

  return (
    <Card.Root w="full" {...panelStyles.root}>
      <Card.Header {...panelStyles.header}>
        <Heading size="md" fontWeight="semibold" color="gray.100">
          Measurement setup
        </Heading>
      </Card.Header>

      <Card.Body {...panelStyles.body}>
        <Box maxW="980px" mx="auto" w="full">
          <Stack gap={6}>
            <Tabs.Root
              value={setupMode}
              onValueChange={(details) => setSetupMode(details.value as SetupMode)}
              variant="enclosed"
            >
              <Tabs.List {...tabStyles.list} maxW="480px">
                <Tabs.Trigger value="simple" {...tabStyles.trigger} flex={1}>
                  Simple
                </Tabs.Trigger>
                <Tabs.Trigger value="advanced" {...tabStyles.trigger} flex={1}>
                  Advanced
                </Tabs.Trigger>
                <Tabs.Trigger value="test" {...tabStyles.trigger} flex={1}>
                  Test
                </Tabs.Trigger>
              </Tabs.List>

              <Tabs.Content value="simple" pt={5}>
                <SimpleSetupTab state={state} />
              </Tabs.Content>

              <Tabs.Content value="advanced" pt={5}>
                <AdvancedSetupFields state={state} />
              </Tabs.Content>

              <Tabs.Content value="test" pt={5}>
                <AdvancedSetupFields state={state} isTestMode />
              </Tabs.Content>
            </Tabs.Root>

            <Separator borderColor="whiteAlpha.100" />

            <MeasurementActions state={state} />
          </Stack>
        </Box>
      </Card.Body>
    </Card.Root>
  );
}

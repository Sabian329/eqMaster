import {
  Badge,
  Box,
  Card,
  Flex,
  Heading,
  Stack,
  Text,
} from '@chakra-ui/react';
import { panelStyles, ui } from '../../theme';
import { AdvancedSetupFields } from '../advanced-setup';
import { MeasurementActions } from './MeasurementActions';
import type { ConfigPanelProps } from './types';

export function ConfigPanel({ state }: ConfigPanelProps) {
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
            borderColor={`${ui.colors.accent}66`}
            bg={`${ui.colors.accent}12`}
            color={ui.colors.accent}
            fontFamily={ui.fonts.mono}
          >
            Live measurement
          </Badge>
        </Flex>
      </Card.Header>

      <Card.Body {...panelStyles.body} p={{ base: 4, md: 6 }}>
        <Stack gap={6}>
          <AdvancedSetupFields state={state} />

          <Box h="1px" bg={ui.colors.border} />

          <MeasurementActions state={state} />
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}

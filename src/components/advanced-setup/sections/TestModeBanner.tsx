import { Badge, Box, HStack, Text } from '@chakra-ui/react';
import { ui } from '../../../theme';

export function TestModeBanner() {
  return (
    <Box
      p={3}
      borderRadius="2px"
      borderWidth="1px"
      borderColor={ui.colors.warn}
      bg="rgba(230,180,80,.08)"
    >
      <HStack gap={2} mb={2} flexWrap="wrap">
        <Badge
          bg={ui.colors.inset}
          color={ui.colors.warn}
          borderWidth="1px"
          borderColor={ui.colors.warn}
          borderRadius="2px"
          px={2}
          py={0.5}
          fontSize="2xs"
          fontWeight="700"
          letterSpacing="0.06em"
          textTransform="uppercase"
        >
          Test bench
        </Badge>
        <Text fontSize="xs" fontWeight="700" color={ui.colors.text} letterSpacing="0.02em">
          Mock measurement — no microphone or speakers
        </Text>
      </HStack>
      <Text fontSize="2xs" color={ui.colors.textMuted} lineHeight="1.65">
        Results use a fixed synthetic frequency response with known peaks and dips. Use this
        to try EQ correction and presets without hardware.
      </Text>
    </Box>
  );
}

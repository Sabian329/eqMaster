import { Badge, Box, HStack, Text } from '@chakra-ui/react';

export function TestModeBanner() {
  return (
    <Box
      p={4}
      borderRadius="xl"
      borderWidth="1px"
      borderColor="rgba(255, 191, 90, 0.35)"
      bg="rgba(255, 191, 90, 0.08)"
    >
      <HStack gap={2} mb={2}>
        <Badge
          bg="rgba(255,191,90,.16)"
          color="#ffd28c"
          borderWidth="1px"
          borderColor="rgba(255,191,90,.35)"
          borderRadius="md"
          px={2}
          py={0.5}
          fontSize="xs"
          fontWeight="semibold"
        >
          Test mode
        </Badge>
        <Text fontSize="sm" fontWeight="medium" color="gray.200">
          Mock measurement — no microphone or speakers
        </Text>
      </HStack>
      <Text fontSize="xs" color="gray.400" lineHeight="1.65">
        Results use a fixed synthetic frequency response with known peaks and dips. Use this
        to try tone targets, band counts, and EQ presets without hardware. Sweep settings
        below still apply to the mock curve range.
      </Text>
    </Box>
  );
}

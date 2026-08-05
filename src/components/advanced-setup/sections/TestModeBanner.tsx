import { Badge, Box, HStack, Text } from '@chakra-ui/react';

export function TestModeBanner() {
  return (
    <Box
      p={4}
      borderRadius="2xl"
      borderWidth="1px"
      borderColor="rgba(255, 191, 90, 0.35)"
      bg="linear-gradient(145deg, rgba(255,191,90,.12), rgba(12,16,24,.55))"
      boxShadow="inset 0 1px 0 rgba(255,255,255,.04)"
    >
      <HStack gap={2} mb={2} flexWrap="wrap">
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
          Test bench
        </Badge>
        <Text fontSize="sm" fontWeight="semibold" color="gray.100">
          Mock measurement — no microphone or speakers
        </Text>
      </HStack>
      <Text fontSize="xs" color="gray.500" lineHeight="1.65">
        Results use a fixed synthetic frequency response with known peaks and dips. Use this
        to try tone targets, EQ strategies, and presets without hardware. Profile and sweep
        settings still shape the mock curve range.
      </Text>
    </Box>
  );
}

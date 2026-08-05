import { Box, HStack, Text } from '@chakra-ui/react';
import { dbToMeterPercent, formatDb } from '../../utils/format';

interface LevelMeterProps {
  meterDb: number;
  minWidth?: string;
}

export function LevelMeter({ meterDb, minWidth = '72px' }: LevelMeterProps) {
  return (
    <HStack gap={3}>
      <Box
        flex={1}
        h="10px"
        borderRadius="full"
        overflow="hidden"
        borderWidth="1px"
        borderColor="whiteAlpha.200"
        bg="linear-gradient(90deg, rgba(85,214,139,.15) 0 72%, rgba(255,191,90,.18) 72% 90%, rgba(255,114,114,.18) 90% 100%)"
      >
        <Box
          h="full"
          w={`${dbToMeterPercent(meterDb)}%`}
          bg="linear-gradient(90deg, #55d68b, #ffbf5a 78%, #ff7272)"
          transition="width 0.06s linear"
        />
      </Box>
      <Text
        fontSize="xs"
        color="gray.300"
        minW={minWidth}
        textAlign="right"
        fontVariantNumeric="tabular-nums"
      >
        {formatDb(meterDb)}FS
      </Text>
    </HStack>
  );
}

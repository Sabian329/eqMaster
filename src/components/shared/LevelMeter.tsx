import { Box, HStack, Text } from '@chakra-ui/react';
import {
  METER_OPTIMAL_MAX_DB,
  METER_OPTIMAL_MIN_DB,
  dbToMeterPercent,
  formatDb,
  isMeterInOptimalRange,
} from '../../utils/format';

interface LevelMeterProps {
  meterDb: number;
  minWidth?: string;
}

export function LevelMeter({ meterDb, minWidth = '72px' }: LevelMeterProps) {
  const levelPercent = dbToMeterPercent(meterDb);
  const optimalStart = dbToMeterPercent(METER_OPTIMAL_MIN_DB);
  const optimalEnd = dbToMeterPercent(METER_OPTIMAL_MAX_DB);
  const inOptimal = isMeterInOptimalRange(meterDb);

  return (
    <HStack gap={3} align="center">
      <Box
        flex={1}
        position="relative"
        h="12px"
        borderRadius="full"
        overflow="hidden"
        borderWidth="1px"
        borderColor="whiteAlpha.200"
        bg={`linear-gradient(90deg,
          rgba(255, 90, 90, 0.42) 0%,
          rgba(255, 90, 90, 0.42) ${optimalStart}%,
          rgba(85, 214, 139, 0.55) ${optimalStart}%,
          rgba(85, 214, 139, 0.55) ${optimalEnd}%,
          rgba(255, 90, 90, 0.42) ${optimalEnd}%,
          rgba(255, 90, 90, 0.42) 100%)`}
      >
        <Box
          position="absolute"
          top="0"
          bottom="0"
          left={`${levelPercent}%`}
          w="3px"
          borderRadius="full"
          bg={inOptimal ? '#8ff0b8' : '#ff8a8a'}
          boxShadow={
            inOptimal
              ? '0 0 8px rgba(143, 240, 184, 0.85)'
              : '0 0 8px rgba(255, 138, 138, 0.85)'
          }
          transform="translateX(-50%)"
          transition="left 0.06s linear, background 0.12s ease"
        />
      </Box>
      <Text
        fontSize="xs"
        color={inOptimal ? 'green.200' : 'red.200'}
        minW={minWidth}
        textAlign="right"
        fontVariantNumeric="tabular-nums"
      >
        {formatDb(meterDb)}FS
      </Text>
    </HStack>
  );
}

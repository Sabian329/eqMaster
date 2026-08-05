import { Box, HStack, Text } from '@chakra-ui/react';
import { ui } from '../../theme';
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
        h="10px"
        borderRadius="0"
        overflow="hidden"
        borderWidth="1px"
        borderColor={ui.colors.border}
        bg={ui.colors.inset}
      >
        <Box
          position="absolute"
          top="0"
          bottom="0"
          left={`${optimalStart}%`}
          w={`${optimalEnd - optimalStart}%`}
          bg="rgba(82,209,182,.25)"
          pointerEvents="none"
        />
        <Box
          position="absolute"
          top="0"
          bottom="0"
          left={`${levelPercent}%`}
          w="2px"
          borderRadius="0"
          bg={inOptimal ? ui.colors.accent : ui.colors.danger}
          transform="translateX(-50%)"
          transition="left 0.06s linear, background 0.12s ease"
        />
      </Box>
      <Text
        fontSize="2xs"
        color={inOptimal ? ui.colors.accent : ui.colors.danger}
        minW={minWidth}
        textAlign="right"
        fontVariantNumeric="tabular-nums"
        fontFamily={ui.fonts.mono}
        fontWeight="700"
      >
        {formatDb(meterDb)}FS
      </Text>
    </HStack>
  );
}

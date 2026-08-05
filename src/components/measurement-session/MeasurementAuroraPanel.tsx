import { Box } from '@chakra-ui/react';
import type { MeasurementAudioFrame } from '../../audio/measurementAudioVisual';
import { modalStyles, ui } from '../../theme';
import SoftAurora from './SoftAurora';

interface MeasurementAuroraPanelProps {
  active: boolean;
  getAudioFrame: () => MeasurementAudioFrame | null;
}

export function MeasurementAuroraPanel({ active, getAudioFrame }: MeasurementAuroraPanelProps) {
  return (
    <Box
      {...modalStyles.inset}
      {...modalStyles.auroraSlot}
      p={0}
      overflow="hidden"
      position="relative"
      aria-hidden={!active}
    >
      {active ? (
        <SoftAurora getAudioFrame={getAudioFrame} />
      ) : (
        <Box
          h="full"
          bg={ui.colors.inset}
          borderWidth="1px"
          borderColor={ui.colors.border}
          opacity={0.65}
        />
      )}
    </Box>
  );
}

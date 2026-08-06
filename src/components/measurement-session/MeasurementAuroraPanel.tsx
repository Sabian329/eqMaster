import { Box } from '@chakra-ui/react';
import type { MeasurementAudioFrame } from '../../audio/measurementAudioVisual';
import { modalStyles } from '../../theme';
import SoftAurora from './SoftAurora';

interface MeasurementAuroraPanelProps {
  active: boolean;
  getAudioFrame: () => MeasurementAudioFrame | null;
}

export function MeasurementAuroraPanel({
  active,
  getAudioFrame,
}: MeasurementAuroraPanelProps) {
  if (!active) return null;

  return (
    <Box
      {...modalStyles.inset}
      {...modalStyles.auroraSlot}
      p={0}
      overflow="hidden"
      position="relative"
    >
      <SoftAurora getAudioFrame={getAudioFrame} />
    </Box>
  );
}

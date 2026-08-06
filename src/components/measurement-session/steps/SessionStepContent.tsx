import { Text } from '@chakra-ui/react';
import { modalStyles } from '../../../theme';
import type { MeasurementSessionStep } from '../../../types';
import { getSessionStepDescription } from '../utils';

interface SessionStepContentProps {
  sessionStep: MeasurementSessionStep;
  isTestMode: boolean;
  allRunsDone: boolean;
}

export function SessionStepContent({
  sessionStep,
  isTestMode,
  allRunsDone,
}: SessionStepContentProps) {
  if (sessionStep === 'mic-test') return null;

  return (
    <Text {...modalStyles.subtitle} lineHeight="1.65">
      {getSessionStepDescription(sessionStep, isTestMode, allRunsDone)}
    </Text>
  );
}

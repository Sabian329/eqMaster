import { Text } from '@chakra-ui/react';
import { modalStyles } from '../../../theme';
import type { MeasurementSessionStep } from '../../../types';
import { getSessionStepDescription } from '../utils';

interface SessionStepContentProps {
  sessionStep: MeasurementSessionStep;
  allRunsDone: boolean;
}

export function SessionStepContent({
  sessionStep,
  allRunsDone,
}: SessionStepContentProps) {
  if (sessionStep === 'mic-test') return null;

  return (
    <Text {...modalStyles.subtitle} lineHeight="1.65">
      {getSessionStepDescription(sessionStep, allRunsDone)}
    </Text>
  );
}

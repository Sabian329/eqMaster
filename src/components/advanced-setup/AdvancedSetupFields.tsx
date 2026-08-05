import { Stack } from '@chakra-ui/react';
import { DeviceSection } from './sections/DeviceSection';
import { SweepSection } from './sections/SweepSection';
import {
  CalibrationLevelSection,
  SessionSettingsSection,
  TestLoadedPanel,
} from './sections/SessionSettingsSection';
import { TestModeBanner } from './sections/TestModeBanner';
import type { AdvancedSetupFieldsProps } from './types';

export function AdvancedSetupFields({
  state,
  isTestMode = false,
}: AdvancedSetupFieldsProps) {
  const hardwareDisabled = isTestMode;
  const { curve } = state;

  return (
    <Stack gap={5}>
      {isTestMode && <TestModeBanner />}

      <DeviceSection
        state={state}
        isTestMode={isTestMode}
        hardwareDisabled={hardwareDisabled}
      />

      <SweepSection state={state} />

      <SessionSettingsSection state={state} isTestMode={isTestMode} />

      <CalibrationLevelSection
        state={state}
        isTestMode={isTestMode}
        hardwareDisabled={hardwareDisabled}
      />

      {isTestMode && curve.length > 0 && <TestLoadedPanel state={state} />}
    </Stack>
  );
}

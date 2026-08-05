import { Field, NativeSelect, SimpleGrid } from '@chakra-ui/react';
import type { RoomEqState } from '../../../hooks/useRoomEq';
import { fieldStyles } from '../../../theme';
import { DeviceActionButtons, FormHelper, FormLabel } from '../../shared';
import { DeviceStatusAlert } from '../../ui/StatusAlert';

interface DeviceSectionProps {
  state: RoomEqState;
  isTestMode: boolean;
  hardwareDisabled: boolean;
}

export function DeviceSection({ state, isTestMode, hardwareDisabled }: DeviceSectionProps) {
  const {
    env,
    sinkHelp,
    deviceStatus,
    inputs,
    outputs,
    inputDeviceId,
    setInputDeviceId,
    outputDeviceId,
    setOutputDeviceId,
    handleRequestPermission,
    handleChooseOutput,
    handleRefreshDevices,
  } = state;

  return (
    <>
      <DeviceActionButtons
        env={env}
        sinkHelp={sinkHelp}
        disabled={hardwareDisabled}
        onRequestPermission={handleRequestPermission}
        onChooseOutput={handleChooseOutput}
        onRefreshDevices={handleRefreshDevices}
      />

      {!isTestMode && (
        <DeviceStatusAlert message={deviceStatus.message} type={deviceStatus.type} />
      )}

      <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
        <Field.Root>
          <FormLabel>Microphone input</FormLabel>
          <NativeSelect.Root size="md" disabled={hardwareDisabled}>
            <NativeSelect.Field
              {...fieldStyles.control}
              value={inputDeviceId}
              onChange={(e) => setInputDeviceId(e.target.value)}
            >
              <option value="">Default input</option>
              {inputs.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Input ${index + 1} — name hidden by browser`}
                </option>
              ))}
            </NativeSelect.Field>
          </NativeSelect.Root>
          {isTestMode && (
            <FormHelper>Ignored in test mode — mock mic is used.</FormHelper>
          )}
        </Field.Root>

        <Field.Root>
          <FormLabel>Audio output</FormLabel>
          <NativeSelect.Root size="md" disabled={!env.supportsSink || hardwareDisabled}>
            <NativeSelect.Field
              {...fieldStyles.control}
              value={outputDeviceId}
              onChange={(e) => setOutputDeviceId(e.target.value)}
            >
              <option value="">System default output</option>
              {outputs.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Output ${index + 1} — name hidden by browser`}
                </option>
              ))}
            </NativeSelect.Field>
          </NativeSelect.Root>
          <FormHelper>
            {isTestMode ? 'Ignored in test mode — no audio is played.' : sinkHelp}
          </FormHelper>
        </Field.Root>
      </SimpleGrid>
    </>
  );
}

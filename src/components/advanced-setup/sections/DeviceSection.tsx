import {
  Box,
  Field,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react';
import type { ChannelMode } from '../../../types';
import type { RoomEqState } from '../../../hooks/useRoomEq';
import { fieldStyles, setupSectionStyles } from '../../../theme';
import { DeviceActionButtons, FormHelper, FormLabel } from '../../shared';
import { DeviceStatusAlert } from '../../ui/StatusAlert';
import { CHANNEL_OPTIONS } from '../constants';

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
    channel,
    setChannel,
    handleRequestPermission,
    handleChooseOutput,
    handleRefreshDevices,
  } = state;

  return (
    <Stack gap={4}>
      <Box {...setupSectionStyles.actionBar}>
        <Text fontSize="xs" fontWeight="medium" color="gray.500" mb={2.5}>
          Device access
        </Text>
        <DeviceActionButtons
          env={env}
          sinkHelp={sinkHelp}
          disabled={hardwareDisabled}
          onRequestPermission={handleRequestPermission}
          onChooseOutput={handleChooseOutput}
          onRefreshDevices={handleRefreshDevices}
        />
      </Box>

      {!isTestMode && (
        <DeviceStatusAlert message={deviceStatus.message} type={deviceStatus.type} />
      )}

      <SimpleGrid {...setupSectionStyles.fieldGrid}>
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
          {isTestMode ? (
            <FormHelper>Ignored in test mode — mock mic is used.</FormHelper>
          ) : (
            <FormHelper>Measurement microphone or interface input.</FormHelper>
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

        <Field.Root gridColumn={{ md: '1 / -1' }}>
          <FormLabel>Measured channel</FormLabel>
          <NativeSelect.Root size="md" disabled={hardwareDisabled}>
            <NativeSelect.Field
              {...fieldStyles.control}
              maxW={{ md: '280px' }}
              value={channel}
              onChange={(e) => setChannel(e.target.value as ChannelMode)}
            >
              {CHANNEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </NativeSelect.Field>
          </NativeSelect.Root>
          <FormHelper>Which speaker channel the sweep excites during this session.</FormHelper>
        </Field.Root>
      </SimpleGrid>
    </Stack>
  );
}

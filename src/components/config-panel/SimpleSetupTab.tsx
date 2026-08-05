import {
  Badge,
  Box,
  Field,
  HStack,
  NativeSelect,
  SimpleGrid,
  Stack,
  Stat,
  Text,
} from '@chakra-ui/react';
import type { MeasurementPresetId } from '../../config/measurementPresets';
import type { ChannelMode } from '../../types';
import {
  badgeStyles,
  fieldStyles,
  statLabelStyle,
  statValueStyle,
} from '../../theme';
import { DeviceActionButtons, FormHelper, FormLabel } from '../shared';
import { DeviceStatusAlert } from '../ui/StatusAlert';
import { CHANNEL_OPTIONS, SMOOTHING_OPTIONS, formatLevelLabel } from './constants';
import type { SimpleSetupTabProps } from './types';

export function SimpleSetupTab({ state }: SimpleSetupTabProps) {
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
    fStart,
    fEnd,
    duration,
    smoothing,
    level,
    activeMeasurementPresetId,
    applyMeasurementPreset,
    measurementPresets,
    handleRequestPermission,
    handleChooseOutput,
    handleRefreshDevices,
  } = state;

  const activePreset = measurementPresets.find((p) => p.id === activeMeasurementPresetId);
  const levelLabel = formatLevelLabel(level);

  return (
    <Stack gap={5}>
      <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
        <Field.Root>
          <FormLabel>Scene preset</FormLabel>
          <NativeSelect.Root size="md">
            <NativeSelect.Field
              {...fieldStyles.control}
              value={activeMeasurementPresetId}
              onChange={(e) =>
                applyMeasurementPreset(e.target.value as MeasurementPresetId)
              }
            >
              {measurementPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} — {preset.tagline}
                </option>
              ))}
            </NativeSelect.Field>
          </NativeSelect.Root>
          {activePreset && <FormHelper>{activePreset.description}</FormHelper>}
        </Field.Root>

        <Field.Root>
          <FormLabel>Measured channel</FormLabel>
          <NativeSelect.Root size="md">
            <NativeSelect.Field
              {...fieldStyles.control}
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
          <FormHelper>Speaker channel for this measurement run.</FormHelper>
        </Field.Root>
      </SimpleGrid>

      <DeviceActionButtons
        env={env}
        sinkHelp={sinkHelp}
        onRequestPermission={handleRequestPermission}
        onChooseOutput={handleChooseOutput}
        onRefreshDevices={handleRefreshDevices}
      />

      <DeviceStatusAlert message={deviceStatus.message} type={deviceStatus.type} />

      <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
        <Field.Root>
          <FormLabel>Microphone input</FormLabel>
          <NativeSelect.Root size="md">
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
        </Field.Root>

        <Field.Root>
          <FormLabel>Audio output</FormLabel>
          <NativeSelect.Root size="md" disabled={!env.supportsSink}>
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
          <FormHelper>{sinkHelp}</FormHelper>
        </Field.Root>
      </SimpleGrid>

      <Box
        p={4}
        borderRadius="xl"
        bg="whiteAlpha.50"
        borderWidth="1px"
        borderColor="whiteAlpha.100"
      >
        <HStack justify="space-between" mb={4}>
          <Text fontSize="sm" fontWeight="medium" color="gray.300">
            Preset summary
          </Text>
          {activePreset && <Badge {...badgeStyles.info}>{activePreset.name}</Badge>}
        </HStack>
        <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
          <Stat.Root size="sm">
            <Stat.Label {...statLabelStyle}>Range</Stat.Label>
            <Stat.ValueText {...statValueStyle} fontSize="sm">
              {fStart} – {fEnd} Hz
            </Stat.ValueText>
          </Stat.Root>
          <Stat.Root size="sm">
            <Stat.Label {...statLabelStyle}>Sweep</Stat.Label>
            <Stat.ValueText {...statValueStyle} fontSize="sm">
              {duration} s
            </Stat.ValueText>
          </Stat.Root>
          <Stat.Root size="sm">
            <Stat.Label {...statLabelStyle}>Smoothing</Stat.Label>
            <Stat.ValueText {...statValueStyle} fontSize="sm">
              {SMOOTHING_OPTIONS.find((o) => o.value === smoothing)?.label}
            </Stat.ValueText>
          </Stat.Root>
          <Stat.Root size="sm">
            <Stat.Label {...statLabelStyle}>Level</Stat.Label>
            <Stat.ValueText {...statValueStyle} fontSize="sm">
              {levelLabel}
            </Stat.ValueText>
          </Stat.Root>
        </SimpleGrid>
      </Box>
    </Stack>
  );
}

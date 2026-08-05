import {
  Badge,
  Box,
  Button,
  Field,
  Flex,
  HStack,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react';
import type { MeasurementCount } from '../../../types';
import type { RoomEqState } from '../../../hooks/useRoomEq';
import { meterOptimalRangeLabel } from '../../../utils/format';
import { badgeStyles, buttonStyles, fieldStyles, setupSectionStyles } from '../../../theme';
import { FilePicker, FormHelper, FormLabel, LevelMeter } from '../../shared';
import { MEASUREMENT_COUNT_OPTIONS } from '../constants';

interface SessionSettingsSectionProps {
  state: RoomEqState;
  isTestMode: boolean;
}

export function SessionSettingsSection({ state, isTestMode }: SessionSettingsSectionProps) {
  const { measurementCount, setMeasurementCount } = state;

  return (
    <SimpleGrid {...setupSectionStyles.fieldGrid}>
      <Field.Root>
        <FormLabel>Measurements per session</FormLabel>
        <NativeSelect.Root size="md">
          <NativeSelect.Field
            {...fieldStyles.control}
            value={measurementCount}
            onChange={(e) =>
              setMeasurementCount(Number(e.target.value) as MeasurementCount)
            }
          >
            {MEASUREMENT_COUNT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </NativeSelect.Field>
        </NativeSelect.Root>
        <FormHelper>
          {isTestMode
            ? 'Each mock run varies slightly — useful for testing averaging.'
            : 'Run multiple sweeps and average — reduces noise and seat-to-seat variation.'}
        </FormHelper>
      </Field.Root>
    </SimpleGrid>
  );
}

interface CalibrationLevelSectionProps {
  state: RoomEqState;
  isTestMode: boolean;
  hardwareDisabled: boolean;
}

export function CalibrationLevelSection({
  state,
  isTestMode,
  hardwareDisabled,
}: CalibrationLevelSectionProps) {
  const {
    calibrationStatus,
    meterActive,
    meterDb,
    handleCalibrationFile,
    handleStartMeter,
    handleStopMeter,
  } = state;

  return (
    <SimpleGrid {...setupSectionStyles.fieldGrid}>
      <Field.Root>
        <FormLabel>Mic calibration file</FormLabel>
        <FilePicker
          accept=".txt,.csv,.cal"
          disabled={hardwareDisabled}
          buttonLabel="Choose file"
          placeholder="No calibration file"
          onFileChange={handleCalibrationFile}
        />
        <FormHelper>{isTestMode ? 'Not used in test mode.' : calibrationStatus}</FormHelper>
      </Field.Root>

      <Box
        {...setupSectionStyles.insetPanel}
        opacity={hardwareDisabled ? 0.55 : 1}
      >
        <Flex justify="space-between" align="flex-start" gap={3} mb={3} flexWrap="wrap">
          <Stack gap={0.5} flex={1}>
            <Text fontSize="sm" fontWeight="semibold" color="gray.200">
              Pre-measurement level check
            </Text>
            <Text fontSize="xs" color="gray.500" lineHeight="1.55">
              {isTestMode
                ? 'Unavailable in test mode — no live audio.'
                : `Pink noise at sweep level with live mic meter. Aim for the green zone (${meterOptimalRangeLabel()}).`}
            </Text>
          </Stack>
          {!meterActive ? (
            <Button
              size="sm"
              borderRadius="lg"
              {...buttonStyles.secondary}
              disabled={hardwareDisabled}
              onClick={() => handleStartMeter().catch((e) => alert(e.message))}
            >
              Start level check
            </Button>
          ) : (
            <Button
              size="sm"
              borderRadius="lg"
              {...buttonStyles.danger}
              onClick={handleStopMeter}
            >
              Stop
            </Button>
          )}
        </Flex>

        {meterActive && <LevelMeter meterDb={meterDb} />}
      </Box>
    </SimpleGrid>
  );
}

interface TestLoadedPanelProps {
  state: RoomEqState;
}

export function TestLoadedPanel({ state }: TestLoadedPanelProps) {
  const { suggestions, loadMockDemoResults, isMockMeasurement } = state;

  return (
    <Box
      p={4}
      borderRadius="xl"
      borderWidth="1px"
      borderColor="rgba(255,191,90,.35)"
      bg="linear-gradient(145deg, rgba(255,191,90,.1), rgba(12,16,24,.5))"
    >
      <Text fontSize="sm" fontWeight="semibold" color="gray.100" mb={1}>
        Test measurement loaded
      </Text>
      <Text fontSize="xs" color="gray.500" lineHeight="1.6" mb={3}>
        Adjust EQ on the chart below — filters and preamp update the After EQ curve in real time.
      </Text>
      <HStack gap={2} flexWrap="wrap">
        <Button
          size="sm"
          borderRadius="lg"
          {...buttonStyles.secondary}
          onClick={loadMockDemoResults}
        >
          Regenerate mock data
        </Button>
        {isMockMeasurement && (
          <Badge {...badgeStyles.info}>
            {suggestions.length} filter{suggestions.length === 1 ? '' : 's'} active
          </Badge>
        )}
      </HStack>
    </Box>
  );
}

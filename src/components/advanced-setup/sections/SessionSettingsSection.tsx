import {
  Badge,
  Box,
  Button,
  Field,
  Flex,
  HStack,
  Input,
  NativeSelect,
  SimpleGrid,
  Slider,
  Text,
} from '@chakra-ui/react';
import type { MeasurementCount } from '../../../types';
import type { RoomEqState } from '../../../hooks/useRoomEq';
import { badgeStyles, buttonStyles, fieldStyles } from '../../../theme';
import { FormHelper, FormLabel, LevelMeter } from '../../shared';
import { formatLevelLabel, MEASUREMENT_COUNT_OPTIONS } from '../constants';

interface SessionSettingsSectionProps {
  state: RoomEqState;
  isTestMode: boolean;
}

export function SessionSettingsSection({ state, isTestMode }: SessionSettingsSectionProps) {
  const { measurementCount, setMeasurementCount, level, setLevel } = state;
  const levelLabel = formatLevelLabel(level);

  return (
    <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
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
            : 'Average multiple sweeps; finish early anytime.'}
        </FormHelper>
      </Field.Root>

      <Field.Root>
        <Flex justify="space-between" align="center" mb={2}>
          <Field.Label {...fieldStyles.label} mb={0}>
            Sweep digital level
          </Field.Label>
          <Badge {...badgeStyles.info}>{levelLabel}</Badge>
        </Flex>
        <Slider.Root
          w="full"
          min={-36}
          max={-6}
          step={1}
          value={[level]}
          onValueChange={(details) => setLevel(details.value[0])}
          variant="outline"
          colorPalette="brand"
          size="md"
        >
          <Slider.Control py={2} w="full">
            <Slider.Track bg="whiteAlpha.300" shadow="inset">
              <Slider.Range bg="brand.400" />
            </Slider.Track>
            <Slider.Thumbs />
          </Slider.Control>
        </Slider.Root>
        <FormHelper>
          {isTestMode
            ? 'Stored in mock metadata only.'
            : 'Not SPL — depends on interface and monitors.'}
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
    <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
      <Field.Root>
        <FormLabel>Microphone calibration — optional</FormLabel>
        <Input
          type="file"
          accept=".txt,.csv,.cal"
          pt={1}
          disabled={hardwareDisabled}
          {...fieldStyles.control}
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            void handleCalibrationFile(file);
          }}
        />
        <FormHelper>{isTestMode ? 'Not used in test mode.' : calibrationStatus}</FormHelper>
      </Field.Root>

      <Box
        p={4}
        borderRadius="xl"
        borderWidth="1px"
        borderColor="whiteAlpha.100"
        bg="whiteAlpha.40"
        opacity={hardwareDisabled ? 0.55 : 1}
      >
        <Text fontSize="sm" fontWeight="medium" color="gray.300" mb={1}>
          Level check
        </Text>
        <Text fontSize="xs" color="gray.500" mb={3} lineHeight="1.55">
          {isTestMode
            ? 'Unavailable in test mode — no live audio.'
            : 'Pink noise at sweep level + live mic meter.'}
        </Text>
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
            Stop level check
          </Button>
        )}

        {meterActive && (
          <Box mt={4}>
            <LevelMeter meterDb={meterDb} />
          </Box>
        )}
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
      borderColor="whiteAlpha.100"
      bg="whiteAlpha.40"
    >
      <Text fontSize="sm" fontWeight="medium" color="gray.200" mb={1}>
        Test measurement loaded
      </Text>
      <Text fontSize="xs" color="gray.500" lineHeight="1.6" mb={3}>
        Adjust EQ on the chart below — tone target, band count, and filters update the After
        EQ curve in real time.
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

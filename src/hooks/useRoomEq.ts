import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseCalibration } from '../audio/calibration';
import {
  checkEnvironment,
  chooseOutputDevice,
  enumerateAudioDevices,
  requestMicrophonePermission,
} from '../audio/devices';
import { runMeasurement, startLevelTest } from '../audio/measurement';
import type {
  ChannelMode,
  CurvePoint,
  DeviceStatusType,
  MeasurementMeta,
  SelectedOutputDevice,
  Suggestion,
} from '../types';
import { buildPresetText } from '../utils/preset';
import { downloadText, safePresetFilename } from '../utils/download';
import { formatFrequency } from '../utils/format';
import {
  MEASUREMENT_PRESETS,
  type MeasurementPresetId,
} from '../config/measurementPresets';

function getDeviceStatusMessage(
  mediaPermissionGranted: boolean,
  permissionJustGranted: boolean,
  visibleInputCount: number,
  visibleOutputCount: number,
  namesHidden: boolean,
): { message: string; type: DeviceStatusType } {
  if (!mediaPermissionGranted && !permissionJustGranted) {
    return {
      message:
        'The device list is limited by browser privacy. Click “Show inputs” and allow microphone access.',
      type: 'warning',
    };
  }
  if (visibleInputCount === 0) {
    return {
      message:
        'The system returned only the default input alias. Check that your interface is connected, Chrome has microphone access in macOS settings, and the page is served over localhost/HTTPS.',
      type: 'bad',
    };
  }
  if (namesHidden) {
    return {
      message: `Found ${visibleInputCount} inputs and ${visibleOutputCount} outputs, but some names are still hidden. Try granting access again or refresh the page.`,
      type: 'warning',
    };
  }
  const outputText =
    visibleOutputCount > 0
      ? `${visibleOutputCount} outputs`
      : 'system default output only';
  return {
    message: `Found ${visibleInputCount} inputs and ${outputText}.`,
    type: 'good',
  };
}

export function useRoomEq() {
  const env = useMemo(() => checkEnvironment(), []);

  const [mediaPermissionGranted, setMediaPermissionGranted] = useState(false);
  const [selectedOutputDevice, setSelectedOutputDevice] =
    useState<SelectedOutputDevice | null>(null);
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [deviceStatus, setDeviceStatus] = useState({
    message:
      'Before permission is granted, the browser may show only default devices without names.',
    type: '' as DeviceStatusType,
  });

  const [inputDeviceId, setInputDeviceId] = useState('');
  const [outputDeviceId, setOutputDeviceId] = useState('');
  const [channel, setChannel] = useState<ChannelMode>('left');
  const [fStart, setFStart] = useState(20);
  const [fEnd, setFEnd] = useState(20000);
  const [duration, setDuration] = useState(10);
  const [smoothing, setSmoothing] = useState(12);
  const [level, setLevel] = useState(-24);
  const [safetyCheck, setSafetyCheck] = useState(false);
  const [activeMeasurementPresetId, setActiveMeasurementPresetId] =
    useState<MeasurementPresetId>('room');
  const [calibration, setCalibration] = useState<[number, number][]>([]);
  const [calibrationStatus, setCalibrationStatus] = useState(
    'Format: frequency and dB correction in two columns. The correction is added to the result.',
  );

  const [statusText, setStatusText] = useState('Ready');
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);

  const [meterActive, setMeterActive] = useState(false);
  const [meterDb, setMeterDb] = useState(-Infinity);
  const levelTestRef = useRef<{ stop: () => Promise<void> } | null>(null);

  const [curve, setCurve] = useState<CurvePoint[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [measurementMeta, setMeasurementMeta] = useState<MeasurementMeta | null>(null);

  const [presetName, setPresetName] = useState('Room EQ');
  const [presetPreamp, setPresetPreamp] = useState(0);
  const [presetStatus, setPresetStatus] = useState('');

  const refreshDevices = useCallback(
    async (permissionJustGranted = false) => {
      const result = await enumerateAudioDevices();
      let nextInputs = result.inputs;
      let nextOutputs = result.outputs;

      if (
        selectedOutputDevice?.deviceId &&
        !nextOutputs.some((d) => d.deviceId === selectedOutputDevice.deviceId)
      ) {
        nextOutputs = [
          ...nextOutputs,
          {
            deviceId: selectedOutputDevice.deviceId,
            kind: 'audiooutput' as MediaDeviceKind,
            label: selectedOutputDevice.label,
            groupId: '',
            toJSON: () => ({}),
          },
        ];
      }

      setInputs(nextInputs);
      setOutputs(nextOutputs);

      const status = getDeviceStatusMessage(
        mediaPermissionGranted,
        permissionJustGranted,
        nextInputs.length,
        nextOutputs.length,
        result.unnamedInputs + result.unnamedOutputs > 0,
      );
      setDeviceStatus(status);
    },
    [mediaPermissionGranted, selectedOutputDevice],
  );

  useEffect(() => {
    refreshDevices().catch(() => {});
  }, [refreshDevices]);

  useEffect(() => {
    const handler = () => {
      refreshDevices().catch(() => {});
    };
    navigator.mediaDevices?.addEventListener?.('devicechange', handler);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', handler);
    };
  }, [refreshDevices]);

  useEffect(() => {
    return () => {
      levelTestRef.current?.stop().catch(() => {});
    };
  }, []);

  const setStatus = useCallback((text: string, prog = 0) => {
    setStatusText(text);
    setProgress(Math.max(0, Math.min(100, prog)));
  }, []);

  const environmentBadge = useMemo(() => {
    if (env.ready) {
      return {
        text: env.hasWorklet
          ? 'Environment ready'
          : 'Environment ready · compatibility mode',
        color: 'var(--good)',
      };
    }
    const problems: string[] = [];
    if (!env.secure) problems.push('HTTPS/localhost required');
    if (!env.hasMedia) problems.push('getUserMedia unavailable');
    if (!env.hasAudio) problems.push('Web Audio API unavailable');
    return { text: problems.join(' · '), color: 'var(--bad)' };
  }, [env]);

  const sinkHelp = useMemo(() => {
    if (env.supportsSink && env.supportsOutputPicker) {
      return 'You can pick an output from the list or use the “Choose output” button to grant it permission.';
    }
    if (env.supportsSink) {
      return 'The browser can set output from the list. If the list is empty, set your interface as the macOS default output.';
    }
    return 'This browser does not support Web Audio output selection. The system default output will be used.';
  }, [env]);

  const measureEnabled =
    env.ready && safetyCheck && !running && !meterActive;

  const presetText = useMemo(
    () => buildPresetText(presetName, presetPreamp, suggestions),
    [presetName, presetPreamp, suggestions],
  );

  const handleRequestPermission = async () => {
    setStatus('Waiting for microphone permission…', 0);
    try {
      await requestMicrophonePermission();
      setMediaPermissionGranted(true);
      await refreshDevices(true);
      setStatus('Device list unlocked', 0);
    } catch (error) {
      const err = error as Error & { name?: string };
      const message =
        err.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow the microphone for localhost in Chrome and macOS settings.'
          : err.message || 'Could not get access.';
      setStatus(message, 0);
      setDeviceStatus({ message, type: 'bad' });
      throw new Error(message);
    }
  };

  const handleChooseOutput = async () => {
    const selected = await chooseOutputDevice(outputDeviceId || undefined);
    setSelectedOutputDevice(selected);
    setOutputDeviceId(selected.deviceId);
    await refreshDevices();
    setDeviceStatus({
      message: `Selected output: ${selected.label || 'audio device'}.`,
      type: 'good',
    });
    setStatus('Audio output selected', 0);
  };

  const handleRefreshDevices = async () => {
    await refreshDevices();
    setStatus('Device list refreshed', 0);
  };

  const handleCalibrationFile = async (file: File | null) => {
    if (!file) {
      setCalibration([]);
      setCalibrationStatus(
        'Format: frequency and dB correction in two columns. The correction is added to the result.',
      );
      return;
    }

    try {
      const text = await file.text();
      const points = parseCalibration(text);
      if (points.length < 2) {
        throw new Error('Could not find at least two valid points.');
      }

      setCalibration(points);
      setCalibrationStatus(
        `Loaded ${points.length} points: ${formatFrequency(points[0][0])}–${formatFrequency(points[points.length - 1][0])}.`,
      );
    } catch (error) {
      setCalibration([]);
      const message = error instanceof Error ? error.message : String(error);
      setCalibrationStatus(`File error: ${message}`);
    }
  };

  const handleStartMeter = async () => {
    await levelTestRef.current?.stop();
    setStatus('Starting input test…', 0);
    const session = await startLevelTest(inputDeviceId, outputDeviceId, setMeterDb);
    levelTestRef.current = session;
    setMeterActive(true);
    setStatus('Input test running — aim for a peak around −18 to −8 dBFS', 0);
  };

  const handleStopMeter = async () => {
    await levelTestRef.current?.stop();
    levelTestRef.current = null;
    setMeterActive(false);
    setMeterDb(-Infinity);
    setStatus('Input test stopped', 0);
  };

  const handleMeasure = async () => {
    if (running) return;
    await handleStopMeter();
    setRunning(true);

    try {
      const inputLabel =
        inputs.find((d) => d.deviceId === inputDeviceId)?.label ||
        'Default input';
      const outputLabel =
        outputs.find((d) => d.deviceId === outputDeviceId)?.label ||
        selectedOutputDevice?.label ||
        'Default output';

      const result = await runMeasurement({
        inputDeviceId,
        outputDeviceId,
        channel,
        fMin: fStart,
        fMax: fEnd,
        durationSeconds: duration,
        smoothing,
        levelDb: level,
        calibration,
        inputLabel,
        outputLabel,
        onStatus: setStatus,
      });

      setCurve(result.curve);
      setSuggestions(result.suggestions);
      setMeasurementMeta(result.measurementMeta);
      setPresetStatus(
        result.suggestions.length
          ? `Generated ${result.suggestions.length} filters.`
          : 'No filters to save — preset contains only the name and preamp.',
      );
      setStatus('Measurement complete', 100);
    } finally {
      setRunning(false);
    }
  };

  const exportCsv = () => {
    if (!curve.length) return;
    const rows = [
      ['frequency_hz', 'relative_db'],
      ...curve.map((point) => [point.frequency.toFixed(3), point.db.toFixed(4)]),
    ];
    downloadText(
      'room-eq-measurement.csv',
      rows.map((row) => row.join(';')).join('\n'),
      'text/csv;charset=utf-8',
    );
  };

  const exportJson = () => {
    if (!curve.length) return;
    downloadText(
      'room-eq-measurement.json',
      JSON.stringify({ meta: measurementMeta, curve, suggestions }, null, 2),
      'application/json',
    );
  };

  const copyPreset = async () => {
    const text = presetText;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard unavailable');
      }
      setPresetStatus('Preset copied to clipboard.');
    } catch {
      setPresetStatus(
        'Could not copy automatically — copy the text manually.',
      );
    }
  };

  const exportPresetTxt = () => {
    downloadText(safePresetFilename(presetName), presetText, 'text/plain;charset=utf-8');
    setPresetStatus('TXT file generated.');
  };

  const applyMeasurementPreset = useCallback((id: MeasurementPresetId) => {
    const preset = MEASUREMENT_PRESETS.find((item) => item.id === id);
    if (!preset) return;

    setActiveMeasurementPresetId(id);
    setChannel(preset.channel);
    setFStart(preset.fStart);
    setFEnd(preset.fEnd);
    setDuration(preset.duration);
    setSmoothing(preset.smoothing);
    setLevel(preset.level);
  }, []);

  return {
    env,
    environmentBadge,
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
    setFStart,
    fEnd,
    setFEnd,
    duration,
    setDuration,
    smoothing,
    setSmoothing,
    level,
    setLevel,
    safetyCheck,
    setSafetyCheck,
    activeMeasurementPresetId,
    applyMeasurementPreset,
    measurementPresets: MEASUREMENT_PRESETS,
    calibrationStatus,
    statusText,
    progress,
    running,
    meterActive,
    meterDb,
    measureEnabled,
    curve,
    suggestions,
    measurementMeta,
    presetName,
    setPresetName,
    presetPreamp,
    setPresetPreamp,
    presetText,
    presetStatus,
    handleRequestPermission,
    handleChooseOutput,
    handleRefreshDevices,
    handleCalibrationFile,
    handleStartMeter,
    handleStopMeter,
    handleMeasure,
    exportCsv,
    exportJson,
    copyPreset,
    exportPresetTxt,
  };
}

export type RoomEqState = ReturnType<typeof useRoomEq>;

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
  ChartSeries,
  CurvePoint,
  DeviceStatusType,
  MeasurementCount,
  MeasurementMeta,
  MeasurementRun,
  MeasurementSessionStep,
  SelectedOutputDevice,
  Suggestion,
} from '../types';
import { buildPresetText } from '../utils/preset';
import { downloadText, safePresetFilename } from '../utils/download';
import { formatFrequency } from '../utils/format';
import { averageCurves } from '../utils/averageCurves';
import { createSuggestions } from '../utils/suggestions';
import { sanitizeCurve } from '../utils/sanitizeCurve';
import { applyToneTarget, buildTargetCurve } from '../utils/toneProfile';
import {
  MEASUREMENT_PRESETS,
  type MeasurementPresetId,
} from '../config/measurementPresets';
import {
  EQ_BAND_OPTIONS,
  TONE_PROFILES,
  getToneProfile,
  type EqBandCount,
  type ToneProfileId,
} from '../config/toneProfiles';

const RUN_COLORS = ['#8ec5ff', '#55d68b', '#ffbf5a'];

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

function buildChartSeries(
  runs: MeasurementRun[],
  averaged: MeasurementRun | null,
): ChartSeries[] {
  if (!runs.length && !averaged) return [];

  if (runs.length <= 1 && !averaged) {
    const run = runs[0];
    return run
      ? [
          {
            id: `run-${run.index}`,
            label: run.label,
            curve: run.curve,
            color: '#65a9ff',
            lineWidth: 2.2,
            alpha: 1,
          },
        ]
      : [];
  }

  const series: ChartSeries[] = runs.map((run, index) => ({
    id: `run-${run.index}`,
    label: run.label,
    curve: run.curve,
    color: RUN_COLORS[index] ?? '#8ec5ff',
    lineWidth: 1.6,
    alpha: 0.55,
  }));

  if (averaged) {
    series.push({
      id: 'average',
      label: averaged.label,
      curve: averaged.curve,
      color: '#65a9ff',
      lineWidth: 2.4,
      alpha: 1,
    });
  }

  return series;
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
  const [channel, setChannel] = useState<ChannelMode>('both');
  const [fStart, setFStart] = useState(20);
  const [fEnd, setFEnd] = useState(20000);
  const [duration, setDuration] = useState(10);
  const [smoothing, setSmoothing] = useState(12);
  const [level, setLevel] = useState(-24);
  const [measurementCount, setMeasurementCount] = useState<MeasurementCount>(1);
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
  const sessionMeterRef = useRef<{ stop: () => Promise<void> } | null>(null);

  const [curve, setCurve] = useState<CurvePoint[]>([]);
  const [measurementMeta, setMeasurementMeta] = useState<MeasurementMeta | null>(null);
  const [measurementRuns, setMeasurementRuns] = useState<MeasurementRun[]>([]);
  const [averagedRun, setAveragedRun] = useState<MeasurementRun | null>(null);

  const [eqBandCount, setEqBandCount] = useState<EqBandCount>(8);
  const [toneProfileId, setToneProfileId] = useState<ToneProfileId>('flat');

  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionStep, setSessionStep] = useState<MeasurementSessionStep>('mic-test');
  const [sessionTargetCount, setSessionTargetCount] = useState<MeasurementCount>(1);
  const [sessionRuns, setSessionRuns] = useState<MeasurementRun[]>([]);
  const [sessionMeterActive, setSessionMeterActive] = useState(false);
  const [sessionMeterDb, setSessionMeterDb] = useState(-Infinity);

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
      sessionMeterRef.current?.stop().catch(() => {});
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
    env.ready && safetyCheck && !running && !meterActive && !sessionOpen;

  const activeToneProfile = useMemo(
    () => getToneProfile(toneProfileId),
    [toneProfileId],
  );

  const targetCurve = useMemo(() => {
    if (!curve.length) return [];
    return buildTargetCurve(curve, toneProfileId);
  }, [curve, toneProfileId]);

  const suggestions = useMemo((): Suggestion[] => {
    if (!curve.length) return [];
    const adjustedCurve = applyToneTarget(curve, activeToneProfile);
    return createSuggestions(adjustedCurve, eqBandCount);
  }, [curve, activeToneProfile, eqBandCount]);

  const chartSeries = useMemo(() => {
    const base = buildChartSeries(measurementRuns, averagedRun);
    if (!targetCurve.length) return base;

    return [
      ...base,
      {
        id: 'target',
        label: activeToneProfile.label,
        curve: targetCurve,
        color: '#55d68b',
        lineWidth: 1.6,
        alpha: 0.95,
        dash: [7, 6],
      },
    ];
  }, [measurementRuns, averagedRun, targetCurve, activeToneProfile.label]);

  const eqSummary = useMemo(() => {
    if (!curve.length) return '';
    if (!suggestions.length) {
      return `No filters matched the ${activeToneProfile.label} target — preset will contain only name and preamp.`;
    }
    return `${suggestions.length} filter${suggestions.length > 1 ? 's' : ''} for ${activeToneProfile.label} (max ${eqBandCount} bands).`;
  }, [curve.length, suggestions.length, activeToneProfile.label, eqBandCount]);

  const presetText = useMemo(
    () => buildPresetText(presetName, presetPreamp, suggestions),
    [presetName, presetPreamp, suggestions],
  );

  const getDeviceLabels = useCallback(() => {
    const inputLabel =
      inputs.find((d) => d.deviceId === inputDeviceId)?.label || 'Default input';
    const outputLabel =
      outputs.find((d) => d.deviceId === outputDeviceId)?.label ||
      selectedOutputDevice?.label ||
      'Default output';
    return { inputLabel, outputLabel };
  }, [inputs, outputs, inputDeviceId, outputDeviceId, selectedOutputDevice]);

  const executeMeasurement = useCallback(
    async (onStatus: (text: string, progress: number) => void) => {
      const { inputLabel, outputLabel } = getDeviceLabels();
      return runMeasurement({
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
        onStatus,
      });
    },
    [
      getDeviceLabels,
      inputDeviceId,
      outputDeviceId,
      channel,
      fStart,
      fEnd,
      duration,
      smoothing,
      level,
      calibration,
    ],
  );

  const applySessionResults = useCallback((runs: MeasurementRun[]) => {
    if (!runs.length) return;

    const averagedCurve = sanitizeCurve(averageCurves(runs.map((run) => run.curve)));
    const baseMeta = runs[runs.length - 1].meta;

    const average: MeasurementRun = {
      index: 0,
      label: runs.length > 1 ? 'Average' : runs[0].label,
      curve: averagedCurve,
      suggestions: [],
      meta: {
        ...baseMeta,
        date: new Date().toISOString(),
      },
    };

    setMeasurementRuns(runs);
    setAveragedRun(runs.length > 1 ? average : null);
    setCurve(averagedCurve);
    setMeasurementMeta(baseMeta);
    setPresetStatus('');
    setStatus(
      runs.length > 1
        ? `Session complete — averaged ${runs.length} measurements`
        : 'Measurement complete',
      100,
    );
  }, [setStatus]);

  const stopSessionMeter = useCallback(async () => {
    await sessionMeterRef.current?.stop();
    sessionMeterRef.current = null;
    setSessionMeterActive(false);
    setSessionMeterDb(-Infinity);
  }, []);

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
    setStatus('Starting level check…', 0);
    const session = await startLevelTest(inputDeviceId, outputDeviceId, setMeterDb, {
      levelDb: level,
      channel,
    });
    levelTestRef.current = session;
    setMeterActive(true);
    setStatus(
      'Pink noise is playing at sweep level — adjust output volume and mic gain. Aim for −18 to −8 dBFS.',
      0,
    );
  };

  const handleStopMeter = async () => {
    await levelTestRef.current?.stop();
    levelTestRef.current = null;
    setMeterActive(false);
    setMeterDb(-Infinity);
    setStatus('Input test stopped', 0);
  };

  const handleStartSession = async () => {
    if (running || sessionOpen) return;
    await handleStopMeter();
    await stopSessionMeter();

    setSessionOpen(true);
    setSessionStep('mic-test');
    setSessionTargetCount(measurementCount);
    setSessionRuns([]);
    setSessionMeterDb(-Infinity);
    setStatus('Measurement session started', 0);
  };

  const handleSessionSkipMicTest = () => {
    void stopSessionMeter();
    setSessionStep('ready');
  };

  const handleSessionStartMeter = async () => {
    await sessionMeterRef.current?.stop();
    const session = await startLevelTest(inputDeviceId, outputDeviceId, setSessionMeterDb, {
      levelDb: level,
      channel,
    });
    sessionMeterRef.current = session;
    setSessionMeterActive(true);
  };

  const handleSessionStopMeter = async () => {
    await stopSessionMeter();
  };

  const handleSessionRunMeasurement = async () => {
    if (running) return;
    await stopSessionMeter();
    setRunning(true);
    setSessionStep('measuring');

    try {
      const runIndex = sessionRuns.length + 1;
      const result = await executeMeasurement(setStatus);
      const run: MeasurementRun = {
        index: runIndex,
        label: `Run ${runIndex}`,
        curve: result.curve,
        suggestions: result.suggestions,
        meta: result.measurementMeta,
      };

      setSessionRuns((previous) => [...previous, run]);
      setSessionStep('run-complete');
      setStatus(`Measurement ${runIndex} complete`, 100);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(message, 0);
      setSessionStep('ready');
      alert(message);
    } finally {
      setRunning(false);
    }
  };

  const handleSessionContinue = () => {
    setSessionStep('ready');
    setStatus(`Ready for measurement ${sessionRuns.length + 1}`, 0);
  };

  const handleSessionFinish = async () => {
    if (!sessionRuns.length) return;
    await stopSessionMeter();
    applySessionResults(sessionRuns);
    setSessionOpen(false);
    setSessionStep('mic-test');
    setSessionRuns([]);
  };

  const handleSessionCancel = async () => {
    if (running) return;

    if (
      sessionRuns.length > 0 &&
      !window.confirm('Close the session without saving completed measurements?')
    ) {
      return;
    }

    await stopSessionMeter();
    setSessionOpen(false);
    setSessionStep('mic-test');
    setSessionRuns([]);
    setStatus('Ready', 0);
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
      JSON.stringify(
        {
          meta: measurementMeta,
          curve,
          suggestions,
          toneProfileId,
          eqBandCount,
          runs: measurementRuns,
          average: averagedRun,
        },
        null,
        2,
      ),
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
    measurementCount,
    setMeasurementCount,
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
    eqBandCount,
    setEqBandCount,
    eqBandOptions: EQ_BAND_OPTIONS,
    toneProfileId,
    setToneProfileId,
    activeToneProfile,
    toneProfiles: TONE_PROFILES,
    eqSummary,
    targetCurve,
    measurementMeta,
    measurementRuns,
    averagedRun,
    chartSeries,
    sessionOpen,
    sessionStep,
    sessionTargetCount,
    sessionRuns,
    sessionMeterActive,
    sessionMeterDb,
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
    handleStartSession,
    handleSessionSkipMicTest,
    handleSessionStartMeter,
    handleSessionStopMeter,
    handleSessionRunMeasurement,
    handleSessionContinue,
    handleSessionFinish,
    handleSessionCancel,
    exportCsv,
    exportJson,
    copyPreset,
    exportPresetTxt,
  };
}

export type RoomEqState = ReturnType<typeof useRoomEq>;

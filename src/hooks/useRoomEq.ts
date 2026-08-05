import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseCalibration } from '../audio/calibration';
import {
  checkEnvironment,
  chooseOutputDevice,
  enumerateAudioDevices,
  requestMicrophonePermission,
} from '../audio/devices';
import { getActiveEqFilters, hasEqToApply } from '../audio/eqChain';
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
  SetupMode,
  Suggestion,
} from '../types';
import { buildPresetText } from '../utils/preset';
import { downloadText, safePresetFilename } from '../utils/download';
import { formatFrequency } from '../utils/format';
import { averageCurves } from '../utils/averageCurves';
import { createSuggestions } from '../utils/suggestions';
import { suggestHeadroomPreampDb } from '../utils/perceptualEq';
import { sanitizeCurve } from '../utils/sanitizeCurve';
import { applyToneTarget, buildTargetCurve } from '../utils/toneProfile';
import { buildCorrectedCurve } from '../utils/correctedCurve';
import {
  applySuggestionAdjustments,
  clampSuggestionQ,
  defaultBoostGainForDip,
  isSuggestionEnabled,
  suggestionKey,
} from '../utils/suggestionQ';
import {
  createCustomSuggestion,
  isBandTooClose,
  mergeSuggestions,
} from '../utils/customBands';
import { runMockMeasurement, runMockVerification, createMockMeasurementRun } from '../utils/mockMeasurement';
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
import {
  EQ_STRATEGIES,
  getEqStrategy,
  type EqStrategyId,
} from '../config/eqStrategies';
import { bandColorForIndex } from '../config/bandColors';
import type { FilterOverlay } from '../chart/drawFilterOverlays';

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
  const [fStart, setFStart] = useState(40);
  const [fEnd, setFEnd] = useState(20000);
  const [duration, setDuration] = useState(10);
  const [smoothing, setSmoothing] = useState(6);
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
  const [eqStrategyId, setEqStrategyId] = useState<EqStrategyId>('refined');
  const [toneProfileId, setToneProfileId] = useState<ToneProfileId>('flat');
  const [setupMode, setSetupMode] = useState<SetupMode>('live');

  const isTestMode = setupMode === 'test';

  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionStep, setSessionStep] = useState<MeasurementSessionStep>('mic-test');
  const [sessionTargetCount, setSessionTargetCount] = useState<MeasurementCount>(1);
  const [sessionRuns, setSessionRuns] = useState<MeasurementRun[]>([]);
  const [sessionMeterActive, setSessionMeterActive] = useState(false);
  const [sessionMeterDb, setSessionMeterDb] = useState(-Infinity);

  const [presetName, setPresetName] = useState('Room EQ');
  const [presetPreamp, setPresetPreamp] = useState(0);
  const [presetStatus, setPresetStatus] = useState('');
  const [suggestionQOverrides, setSuggestionQOverrides] = useState<Record<string, number>>({});
  const [suggestionGainOverrides, setSuggestionGainOverrides] = useState<
    Record<string, number>
  >({});
  const [suggestionEnabledOverrides, setSuggestionEnabledOverrides] = useState<
    Record<string, boolean>
  >({});
  const [customSuggestions, setCustomSuggestions] = useState<Suggestion[]>([]);
  const [removedSuggestionKeys, setRemovedSuggestionKeys] = useState<
    Record<string, true>
  >({});
  const [verificationCurve, setVerificationCurve] = useState<CurvePoint[] | null>(null);
  const [verificationMeta, setVerificationMeta] = useState<MeasurementMeta | null>(null);
  const [verificationRunning, setVerificationRunning] = useState(false);
  const [chartSeriesHidden, setChartSeriesHidden] = useState<Record<string, boolean>>({});

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

  const measureEnabled = isTestMode
    ? !running && !meterActive && !sessionOpen
    : env.ready && safetyCheck && !running && !meterActive && !sessionOpen;

  const activeToneProfile = useMemo(
    () => getToneProfile(toneProfileId),
    [toneProfileId],
  );

  const targetCurve = useMemo(() => {
    if (!curve.length) return [];
    return buildTargetCurve(curve, toneProfileId);
  }, [curve, toneProfileId]);

  const computedSuggestions = useMemo((): Suggestion[] => {
    if (!curve.length) return [];
    const adjustedCurve = applyToneTarget(curve, activeToneProfile);
    return createSuggestions(adjustedCurve, eqBandCount, eqStrategyId);
  }, [curve, activeToneProfile, eqBandCount, eqStrategyId]);

  const suggestionSignature = useMemo(
    () =>
      computedSuggestions
        .map((item) => suggestionKey(item))
        .join('|'),
    [computedSuggestions],
  );

  useEffect(() => {
    setSuggestionQOverrides({});
    setSuggestionGainOverrides({});
    setSuggestionEnabledOverrides({});
    setRemovedSuggestionKeys({});
  }, [suggestionSignature]);

  const activeComputedSuggestions = useMemo(
    () =>
      computedSuggestions.filter(
        (item) => !removedSuggestionKeys[suggestionKey(item)],
      ),
    [computedSuggestions, removedSuggestionKeys],
  );

  const mergedSuggestions = useMemo(
    () => mergeSuggestions(activeComputedSuggestions, customSuggestions),
    [activeComputedSuggestions, customSuggestions],
  );

  const suggestions = useMemo(
    () =>
      applySuggestionAdjustments(
        mergedSuggestions,
        suggestionQOverrides,
        suggestionGainOverrides,
        suggestionEnabledOverrides,
      ),
    [
      mergedSuggestions,
      suggestionQOverrides,
      suggestionGainOverrides,
      suggestionEnabledOverrides,
    ],
  );

  const filterOverlays = useMemo((): FilterOverlay[] => {
    return suggestions
      .filter(
        (item) =>
          item.enabled !== false && item.gain !== null && Math.abs(item.gain) > 0.05,
      )
      .map((item, index) => ({
        frequency: item.frequency,
        gain: item.gain ?? 0,
        q: item.q,
        color: bandColorForIndex(index),
      }));
  }, [suggestions]);

  const globalBandQ = useMemo(() => {
    if (!suggestions.length) return 1;
    const sorted = suggestions.map((item) => item.q).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }, [suggestions]);

  const setSuggestionQ = useCallback((key: string, q: number) => {
    setSuggestionQOverrides((previous) => ({
      ...previous,
      [key]: clampSuggestionQ(q),
    }));
  }, []);

  const setAllSuggestionQ = useCallback(
    (q: number) => {
      const clamped = clampSuggestionQ(q);
      const next: Record<string, number> = {};
      for (const item of mergedSuggestions) {
        next[suggestionKey(item)] = clamped;
      }
      setSuggestionQOverrides(next);
    },
    [mergedSuggestions],
  );

  const scaleAllSuggestionQ = useCallback(
    (factor: number) => {
      const safeFactor = Math.max(0.25, Math.min(2, factor));
      const next: Record<string, number> = {};
      for (const item of mergedSuggestions) {
        next[suggestionKey(item)] = clampSuggestionQ(item.q * safeFactor);
      }
      setSuggestionQOverrides(next);
    },
    [mergedSuggestions],
  );

  const setSuggestionGain = useCallback((key: string, gain: number) => {
    setSuggestionGainOverrides((previous) => ({
      ...previous,
      [key]: gain,
    }));
  }, []);

  const toggleSuggestionEnabled = useCallback(
    (key: string) => {
      const item = mergedSuggestions.find((entry) => suggestionKey(entry) === key);
      if (!item) return;

      setSuggestionEnabledOverrides((previous) => {
        const currentlyEnabled = isSuggestionEnabled(item, previous);
        const nextEnabled = !currentlyEnabled;

        if (nextEnabled && item.kind === 'null') {
          setSuggestionGainOverrides((gainPrevious) => ({
            ...gainPrevious,
            [key]:
              gainPrevious[key] ?? defaultBoostGainForDip(item.deviation),
          }));
        }

        return { ...previous, [key]: nextEnabled };
      });
    },
    [mergedSuggestions],
  );

  const addCustomBand = useCallback(
    (frequency: number): boolean => {
      if (!curve.length) return false;
      if (isBandTooClose(frequency, mergedSuggestions)) return false;

      const nextBand = createCustomSuggestion(frequency, curve, targetCurve);
      setCustomSuggestions((previous) =>
        [...previous, nextBand].sort((a, b) => a.frequency - b.frequency),
      );
      return true;
    },
    [curve, mergedSuggestions, targetCurve],
  );

  const clearSuggestionOverrides = useCallback((key: string) => {
    setSuggestionQOverrides((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
    setSuggestionGainOverrides((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
    setSuggestionEnabledOverrides((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }, []);

  const removeBand = useCallback(
    (key: string) => {
      if (key.startsWith('custom:')) {
        setCustomSuggestions((previous) =>
          previous.filter((item) => suggestionKey(item) !== key),
        );
      } else {
        setRemovedSuggestionKeys((previous) => ({ ...previous, [key]: true }));
      }
      clearSuggestionOverrides(key);
    },
    [clearSuggestionOverrides],
  );

  const resetSuggestionQ = useCallback(() => {
    setSuggestionQOverrides({});
    setSuggestionGainOverrides({});
    setSuggestionEnabledOverrides({});
  }, []);

  const correctedCurve = useMemo(() => {
    if (!curve.length) return [];
    return buildCorrectedCurve(curve, suggestions, presetPreamp);
  }, [curve, suggestions, presetPreamp]);

  const eqApplyProfile = useMemo(
    () => ({ suggestions, preampDb: presetPreamp }),
    [suggestions, presetPreamp],
  );

  const canApplyVerificationEq = useMemo(
    () => hasEqToApply(eqApplyProfile),
    [eqApplyProfile],
  );

  const verifyEnabled =
    curve.length > 0 &&
    canApplyVerificationEq &&
    !running &&
    !verificationRunning &&
    !sessionOpen &&
    !meterActive &&
    (isTestMode || (env.ready && safetyCheck));

  const clearVerification = useCallback(() => {
    setVerificationCurve(null);
    setVerificationMeta(null);
  }, []);

  const chartSeries = useMemo(() => {
    const base = buildChartSeries(measurementRuns, averagedRun);
    const overlays: ChartSeries[] = [];

    if (targetCurve.length) {
      overlays.push({
        id: 'target',
        label: activeToneProfile.label,
        curve: targetCurve,
        color: '#55d68b',
        lineWidth: 1.6,
        alpha: 0.95,
        dash: [7, 6],
      });
    }

    if (correctedCurve.length) {
      overlays.push({
        id: 'corrected',
        label: 'After EQ (predicted)',
        curve: correctedCurve,
        color: '#ff9f6b',
        lineWidth: 2.4,
        alpha: 1,
      });
    }

    if (verificationCurve?.length) {
      overlays.push({
        id: 'verified',
        label: 'Verified (measured with EQ)',
        curve: verificationCurve,
        color: '#55d68b',
        lineWidth: 2.6,
        alpha: 1,
      });
    }

    return [...base, ...overlays];
  }, [
    measurementRuns,
    averagedRun,
    targetCurve,
    correctedCurve,
    verificationCurve,
    activeToneProfile.label,
  ]);

  const isChartSeriesVisible = useCallback(
    (id: string) => chartSeriesHidden[id] !== true,
    [chartSeriesHidden],
  );

  const toggleChartSeriesVisibility = useCallback((id: string) => {
    setChartSeriesHidden((previous) => ({
      ...previous,
      [id]: previous[id] !== true,
    }));
  }, []);

  const visibleChartSeries = useMemo(
    () => chartSeries.filter((series) => chartSeriesHidden[series.id] !== true),
    [chartSeries, chartSeriesHidden],
  );

  const showFilterOverlays = chartSeriesHidden.corrected !== true;

  const eqSummary = useMemo(() => {
    if (!curve.length) return '';
    if (!suggestions.length) {
      if (Object.keys(removedSuggestionKeys).length > 0) {
        return 'No EQ bands — click the chart to add a band.';
      }
      return `No filters matched the ${activeToneProfile.label} target — preset will contain only name and preamp.`;
    }
    const autoCount = suggestions.filter((item) => item.source !== 'custom').length;
    const customCount = suggestions.filter((item) => item.source === 'custom').length;
    const total = suggestions.length;
    if (!total) {
      return `No filters matched the ${activeToneProfile.label} target — preset will contain only name and preamp.`;
    }
    const customSuffix =
      customCount > 0
        ? ` (${autoCount} auto + ${customCount} custom)`
        : '';
    const strategyLabel = getEqStrategy(eqStrategyId).label;
    let summary = `${total} filter${total > 1 ? 's' : ''} · ${strategyLabel} · ${activeToneProfile.label} (max ${eqBandCount} auto bands)${customSuffix}.`;
    if (eqStrategyId === 'refined') {
      const preampHint = suggestHeadroomPreampDb(suggestions);
      if (preampHint !== null) {
        summary += ` Suggested preamp ${preampHint.toFixed(1)} dB for boost headroom.`;
      }
    }
    return summary;
  }, [
    curve.length,
    suggestions.length,
    suggestions,
    removedSuggestionKeys,
    eqStrategyId,
    activeToneProfile.label,
    eqBandCount,
  ]);

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
    setCustomSuggestions([]);
    setRemovedSuggestionKeys({});
    clearVerification();
    setMeasurementMeta(baseMeta);
    setPresetStatus('');
    setStatus(
      baseMeta.recorderMode === 'mock'
        ? runs.length > 1
          ? `Mock session loaded — averaged ${runs.length} runs`
          : 'Mock measurement loaded'
        : runs.length > 1
          ? `Session complete — averaged ${runs.length} measurements`
          : 'Measurement complete',
      100,
    );
  }, [setStatus, clearVerification]);

  const loadMockDemoResults = useCallback(() => {
    const { inputLabel, outputLabel } = getDeviceLabels();
    const runs: MeasurementRun[] = [];

    for (let runIndex = 1; runIndex <= measurementCount; runIndex++) {
      const { curve: mockCurve, measurementMeta } = createMockMeasurementRun({
        fMin: fStart,
        fMax: fEnd,
        smoothing,
        durationSeconds: duration,
        levelDb: level,
        channel,
        runIndex,
        inputLabel,
        outputLabel,
      });

      runs.push({
        index: runIndex,
        label: `Mock ${runIndex}`,
        curve: mockCurve,
        suggestions: [],
        meta: measurementMeta,
      });
    }

    applySessionResults(runs);
  }, [
    applySessionResults,
    channel,
    duration,
    fEnd,
    fStart,
    getDeviceLabels,
    level,
    measurementCount,
    smoothing,
  ]);

  useEffect(() => {
    if (setupMode !== 'test' || sessionOpen || running || curve.length > 0) return;
    loadMockDemoResults();
  }, [setupMode, sessionOpen, running, curve.length, loadMockDemoResults]);

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
    clearVerification();

    setSessionOpen(true);
    setSessionStep(isTestMode ? 'ready' : 'mic-test');
    setSessionTargetCount(measurementCount);
    setSessionRuns([]);
    setSessionMeterDb(-Infinity);
    setStatus(
      isTestMode ? 'Test session started — mock data only' : 'Measurement session started',
      0,
    );
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
      const { inputLabel, outputLabel } = getDeviceLabels();
      const result = isTestMode
        ? await runMockMeasurement(
            {
              fMin: fStart,
              fMax: fEnd,
              smoothing,
              durationSeconds: duration,
              levelDb: level,
              channel,
              runIndex,
              inputLabel,
              outputLabel,
            },
            setStatus,
          )
        : await executeMeasurement(setStatus);
      const run: MeasurementRun = {
        index: runIndex,
        label: isTestMode ? `Mock ${runIndex}` : `Run ${runIndex}`,
        curve: result.curve,
        suggestions: result.suggestions,
        meta: result.measurementMeta,
      };

      setSessionRuns((previous) => [...previous, run]);
      setSessionStep('run-complete');
      setStatus(
        isTestMode
          ? `Mock measurement ${runIndex} complete`
          : `Measurement ${runIndex} complete`,
        100,
      );
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

  const activeFilterCount = useMemo(
    () => getActiveEqFilters(suggestions).length,
    [suggestions],
  );

  const runVerificationMeasurement = useCallback(async () => {
    if (!curve.length || !canApplyVerificationEq || verificationRunning) return;

    await handleStopMeter();
    setVerificationRunning(true);
    setStatus('Starting verification measurement…', 5);

    try {
      const { inputLabel, outputLabel } = getDeviceLabels();
      const eqApply = eqApplyProfile;

      if (isTestMode) {
        const result = await runMockVerification(
          {
            fMin: fStart,
            fMax: fEnd,
            smoothing,
            durationSeconds: duration,
            levelDb: level,
            channel,
            runIndex: 1,
            inputLabel,
            outputLabel,
            baselineCurve: curve,
            suggestions,
            preampDb: presetPreamp,
          },
          setStatus,
        );
        setVerificationCurve(result.curve);
        setVerificationMeta(result.measurementMeta);
      } else {
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
          eqApply,
        });
        setVerificationCurve(result.curve);
        setVerificationMeta(result.measurementMeta);
      }

      setStatus('Verification complete — compare green Verified vs orange predicted', 100);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(message, 0);
      alert(message);
    } finally {
      setVerificationRunning(false);
    }
  }, [
    curve,
    canApplyVerificationEq,
    verificationRunning,
    getDeviceLabels,
    eqApplyProfile,
    isTestMode,
    fStart,
    fEnd,
    smoothing,
    duration,
    level,
    channel,
    suggestions,
    presetPreamp,
    inputDeviceId,
    outputDeviceId,
    calibration,
    setStatus,
    handleStopMeter,
  ]);

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
    setupMode,
    setSetupMode,
    isTestMode,
    loadMockDemoResults,
    isMockMeasurement: measurementMeta?.recorderMode === 'mock',
    curve,
    suggestions,
    globalBandQ,
    setSuggestionQ,
    setSuggestionGain,
    toggleSuggestionEnabled,
    addCustomBand,
    removeBand,
    setAllSuggestionQ,
    scaleAllSuggestionQ,
    resetSuggestionQ,
    eqBandCount,
    setEqBandCount,
    eqBandOptions: EQ_BAND_OPTIONS,
    eqStrategyId,
    setEqStrategyId,
    eqStrategies: EQ_STRATEGIES,
    filterOverlays,
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
    visibleChartSeries,
    isChartSeriesVisible,
    toggleChartSeriesVisibility,
    showFilterOverlays,
    verificationCurve,
    verificationMeta,
    verificationRunning,
    canApplyVerificationEq,
    verifyEnabled,
    activeFilterCount,
    runVerificationMeasurement,
    clearVerification,
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

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
        'Lista jest ograniczona przez prywatność przeglądarki. Kliknij „Pokaż wszystkie wejścia” i zaakceptuj dostęp do mikrofonu.',
      type: 'warning',
    };
  }
  if (visibleInputCount === 0) {
    return {
      message:
        'System zwrócił tylko alias wejścia domyślnego. Sprawdź, czy interfejs jest podłączony, czy Chrome ma dostęp do mikrofonu w ustawieniach macOS i uruchom stronę przez localhost/HTTPS.',
      type: 'bad',
    };
  }
  if (namesHidden) {
    return {
      message: `Wykryto ${visibleInputCount} wejść i ${visibleOutputCount} wyjść, ale część nazw jest nadal ukryta. Spróbuj ponownie nadać dostęp albo odświeżyć stronę.`,
      type: 'warning',
    };
  }
  const outputText =
    visibleOutputCount > 0
      ? `${visibleOutputCount} wyjść`
      : 'tylko domyślne wyjście systemowe';
  return {
    message: `Wykryto ${visibleInputCount} wejść oraz ${outputText}.`,
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
      'Przed udzieleniem dostępu przeglądarka może pokazywać wyłącznie urządzenia domyślne bez nazw.',
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
  const [calibration, setCalibration] = useState<[number, number][]>([]);
  const [calibrationStatus, setCalibrationStatus] = useState(
    'Format: częstotliwość i korekta dB w dwóch kolumnach. Korekta jest dodawana do wyniku.',
  );

  const [statusText, setStatusText] = useState('Gotowy');
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
          ? 'Środowisko gotowe'
          : 'Środowisko gotowe · tryb zgodności',
        color: 'var(--good)',
      };
    }
    const problems: string[] = [];
    if (!env.secure) problems.push('wymagany HTTPS/localhost');
    if (!env.hasMedia) problems.push('brak getUserMedia');
    if (!env.hasAudio) problems.push('brak Web Audio API');
    return { text: problems.join(' · '), color: 'var(--bad)' };
  }, [env]);

  const sinkHelp = useMemo(() => {
    if (env.supportsSink && env.supportsOutputPicker) {
      return 'Możesz wybrać wyjście z listy albo użyć przycisku „Wybierz wyjście…”, aby nadać mu uprawnienie.';
    }
    if (env.supportsSink) {
      return 'Przeglądarka może ustawić wyjście z listy. Gdy lista jest pusta, ustaw interfejs jako domyślne wyjście macOS.';
    }
    return 'Ta przeglądarka nie obsługuje wyboru wyjścia dla Web Audio. Użyte zostanie domyślne wyjście systemowe.';
  }, [env]);

  const measureEnabled =
    env.ready && safetyCheck && !running && !meterActive;

  const presetText = useMemo(
    () => buildPresetText(presetName, presetPreamp, suggestions),
    [presetName, presetPreamp, suggestions],
  );

  const handleRequestPermission = async () => {
    setStatus('Oczekiwanie na zgodę na mikrofon…', 0);
    try {
      await requestMicrophonePermission();
      setMediaPermissionGranted(true);
      await refreshDevices(true);
      setStatus('Lista urządzeń została odblokowana', 0);
    } catch (error) {
      const err = error as Error & { name?: string };
      const message =
        err.name === 'NotAllowedError'
          ? 'Dostęp do mikrofonu został zablokowany. Zezwól na mikrofon dla localhost w ustawieniach Chrome i macOS.'
          : err.message || 'Nie udało się uzyskać dostępu.';
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
      message: `Wybrane wyjście: ${selected.label || 'urządzenie audio'}.`,
      type: 'good',
    });
    setStatus('Wyjście audio zostało wybrane', 0);
  };

  const handleRefreshDevices = async () => {
    await refreshDevices();
    setStatus('Lista urządzeń odświeżona', 0);
  };

  const handleCalibrationFile = async (file: File | null) => {
    if (!file) {
      setCalibration([]);
      setCalibrationStatus(
        'Format: częstotliwość i korekta dB w dwóch kolumnach. Korekta jest dodawana do wyniku.',
      );
      return;
    }

    try {
      const text = await file.text();
      const points = parseCalibration(text);
      if (points.length < 2) {
        throw new Error('Nie znaleziono co najmniej dwóch poprawnych punktów.');
      }

      setCalibration(points);
      setCalibrationStatus(
        `Wczytano ${points.length} punktów: ${formatFrequency(points[0][0])}–${formatFrequency(points[points.length - 1][0])}.`,
      );
    } catch (error) {
      setCalibration([]);
      const message = error instanceof Error ? error.message : String(error);
      setCalibrationStatus(`Błąd pliku: ${message}`);
    }
  };

  const handleStartMeter = async () => {
    await levelTestRef.current?.stop();
    setStatus('Uruchamianie testu wejścia…', 0);
    const session = await startLevelTest(inputDeviceId, outputDeviceId, setMeterDb);
    levelTestRef.current = session;
    setMeterActive(true);
    setStatus('Test wejścia działa — celuj w peak około −18 do −8 dBFS', 0);
  };

  const handleStopMeter = async () => {
    await levelTestRef.current?.stop();
    levelTestRef.current = null;
    setMeterActive(false);
    setMeterDb(-Infinity);
    setStatus('Test wejścia zatrzymany', 0);
  };

  const handleMeasure = async () => {
    if (running) return;
    await handleStopMeter();
    setRunning(true);

    try {
      const inputLabel =
        inputs.find((d) => d.deviceId === inputDeviceId)?.label ||
        'Domyślne wejście';
      const outputLabel =
        outputs.find((d) => d.deviceId === outputDeviceId)?.label ||
        selectedOutputDevice?.label ||
        'Domyślne wyjście';

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
          ? `Wygenerowano ${result.suggestions.length} filtrów.`
          : 'Brak filtrów do zapisania — preset zawiera tylko nazwę i preamp.',
      );
      setStatus('Pomiar zakończony', 100);
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
        throw new Error('Brak schowka');
      }
      setPresetStatus('Preset skopiowany do schowka.');
    } catch {
      setPresetStatus(
        'Nie udało się skopiować automatycznie — skopiuj tekst ręcznie.',
      );
    }
  };

  const exportPresetTxt = () => {
    downloadText(safePresetFilename(presetName), presetText, 'text/plain;charset=utf-8');
    setPresetStatus('Plik TXT został wygenerowany.');
  };

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

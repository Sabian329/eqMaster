import type { RoomEqState } from '../hooks/useRoomEq';
import { dbToMeterPercent, formatDb } from '../utils/format';

interface ConfigPanelProps {
  state: RoomEqState;
}

export function ConfigPanel({ state }: ConfigPanelProps) {
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
    meterActive,
    meterDb,
    measureEnabled,
    handleRequestPermission,
    handleChooseOutput,
    handleRefreshDevices,
    handleCalibrationFile,
    handleStartMeter,
    handleStopMeter,
    handleMeasure,
  } = state;

  const levelLabel = `${String(level).replace('-', '−')} dB`;

  return (
    <aside className="panel">
      <div className="panel-header">
        <h2>Konfiguracja pomiaru</h2>
      </div>
      <div className="panel-body">
        <div className="form-grid">
          <div className="button-row">
            <button
              type="button"
              className="secondary"
              onClick={() => handleRequestPermission().catch((e) => alert(e.message))}
            >
              Pokaż wszystkie wejścia
            </button>
            <button
              type="button"
              className="secondary"
              disabled={!env.supportsOutputPicker}
              title={
                env.supportsOutputPicker
                  ? 'Otwórz systemowe okno wyboru wyjścia audio'
                  : 'Ta przeglądarka nie udostępnia systemowego selektora wyjścia'
              }
              onClick={() =>
                handleChooseOutput().catch((e) => {
                  if (e?.name !== 'NotAllowedError') alert(e.message);
                })
              }
            >
              Wybierz wyjście…
            </button>
            <button type="button" className="secondary" onClick={() => handleRefreshDevices().catch((e) => alert(e.message))}>
              Odśwież urządzenia
            </button>
          </div>

          <div className={`device-status${deviceStatus.type ? ` ${deviceStatus.type}` : ''}`}>
            {deviceStatus.message}
          </div>

          <label>
            Wejście mikrofonowe
            <select value={inputDeviceId} onChange={(e) => setInputDeviceId(e.target.value)}>
              <option value="">Domyślne wejście</option>
              {inputs.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Wejście ${index + 1} — nazwa ukryta przez przeglądarkę`}
                </option>
              ))}
            </select>
          </label>

          <label>
            Wyjście audio
            <select
              value={outputDeviceId}
              disabled={!env.supportsSink}
              onChange={(e) => setOutputDeviceId(e.target.value)}
            >
              <option value="">Domyślne wyjście systemowe</option>
              {outputs.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Wyjście ${index + 1} — nazwa ukryta przez przeglądarkę`}
                </option>
              ))}
            </select>
            <span className="helper">{sinkHelp}</span>
          </label>

          <label>
            Mierzony kanał
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as typeof channel)}
            >
              <option value="left">Lewy</option>
              <option value="right">Prawy</option>
              <option value="both">Oba jednocześnie</option>
            </select>
          </label>

          <div className="two">
            <label>
              Początek sweepu
              <input
                type="number"
                min={10}
                max={1000}
                step={1}
                value={fStart}
                onChange={(e) => setFStart(Number(e.target.value))}
              />
            </label>
            <label>
              Koniec sweepu
              <input
                type="number"
                min={1000}
                max={24000}
                step={100}
                value={fEnd}
                onChange={(e) => setFEnd(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="two">
            <label>
              Długość sweepu
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                <option value={5}>5 s — szybki</option>
                <option value={10}>10 s — zalecany</option>
                <option value={15}>15 s — dokładniejszy</option>
              </select>
            </label>
            <label>
              Wygładzanie
              <select value={smoothing} onChange={(e) => setSmoothing(Number(e.target.value))}>
                <option value={6}>1/6 oktawy</option>
                <option value={12}>1/12 oktawy</option>
                <option value={24}>1/24 oktawy</option>
                <option value={48}>1/48 oktawy</option>
              </select>
            </label>
          </div>

          <label>
            Poziom cyfrowy sweepu
            <div className="range-row">
              <input
                type="range"
                min={-36}
                max={-6}
                step={1}
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
              />
              <span className="range-value">{levelLabel}</span>
            </div>
            <span className="helper">
              To nie jest poziom SPL. Rzeczywista głośność zależy od ustawienia interfejsu, wzmacniacza i monitorów.
            </span>
          </label>

          <label>
            Plik kalibracyjny mikrofonu — opcjonalnie
            <input
              type="file"
              accept=".txt,.csv,.cal"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                void handleCalibrationFile(file);
              }}
            />
            <span className="helper">{calibrationStatus}</span>
          </label>

          <div className="button-row">
            {!meterActive ? (
              <button
                type="button"
                className="secondary"
                onClick={() => handleStartMeter().catch((e) => alert(e.message))}
              >
                Test wejścia
              </button>
            ) : (
              <button type="button" className="danger" onClick={() => handleStopMeter()}>
                Zatrzymaj test
              </button>
            )}
          </div>

          {meterActive && (
            <div className="meter-wrap" style={{ display: 'flex' }}>
              <div className="meter">
                <div style={{ width: `${dbToMeterPercent(meterDb)}%` }} />
              </div>
              <div className="meter-db">{formatDb(meterDb)}FS</div>
            </div>
          )}

          <label className="check">
            <input
              type="checkbox"
              checked={safetyCheck}
              onChange={(e) => setSafetyCheck(e.target.checked)}
            />
            <span>
              Ustawiłem niską głośność, wyłączyłem direct monitoring i mikrofon nie jest skierowany tak,
              aby łatwo powstało sprzężenie.
            </span>
          </label>

          <button
            type="button"
            className="primary"
            disabled={!measureEnabled}
            onClick={() => handleMeasure().catch((e) => alert(e.message))}
          >
            Rozpocznij pomiar
          </button>

          <div className="status">
            <div className="status-line">
              <span>{statusText}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="progress">
              <div style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <p className="footer-note">
          Wykres jest względny: zakres około 500–2000 Hz jest normalizowany do 0 dB.
          Bez kalibratora SPL aplikacja nie pokazuje dokładnego poziomu głośności w pomieszczeniu.
        </p>
      </div>
    </aside>
  );
}

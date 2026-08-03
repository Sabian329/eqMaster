import type { RoomEqState } from '../hooks/useRoomEq';
import { formatDb } from '../utils/format';
import { FrequencyChart } from './FrequencyChart';

interface ChartPanelProps {
  state: RoomEqState;
}

export function ChartPanel({ state }: ChartPanelProps) {
  const { curve, measurementMeta } = state;

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Charakterystyka częstotliwościowa</h2>
        <div className="legend">
          <span>
            <i className="dot" /> pomiar
          </span>
          <span>
            <i className="dot target" /> target 0 dB
          </span>
        </div>
      </div>
      <FrequencyChart
        curve={curve}
        fMin={measurementMeta?.fMin}
        fMax={measurementMeta?.fMax}
      />
      <div className="stats">
        <div className="stat">
          <span>Sample rate</span>
          <b>
            {measurementMeta
              ? `${Math.round(measurementMeta.sampleRate / 1000)} kHz`
              : '—'}
          </b>
        </div>
        <div className="stat">
          <span>Peak wejścia</span>
          <b>
            {measurementMeta ? formatDb(measurementMeta.peakDb) : '—'}
          </b>
        </div>
        <div className="stat">
          <span>Szum przed sweepem</span>
          <b>
            {measurementMeta ? formatDb(measurementMeta.noiseDb) : '—'}
          </b>
        </div>
        <div className="stat">
          <span>Próbek</span>
          <b>
            {measurementMeta
              ? measurementMeta.samples.toLocaleString('pl-PL')
              : '—'}
          </b>
        </div>
      </div>
    </section>
  );
}

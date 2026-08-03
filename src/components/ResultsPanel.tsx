import { useEffect, useRef } from 'react';
import type { RoomEqState } from '../hooks/useRoomEq';
import { formatDb, formatFrequency } from '../utils/format';

interface ResultsPanelProps {
  state: RoomEqState;
}

export function ResultsPanel({ state }: ResultsPanelProps) {
  const {
    curve,
    suggestions,
    presetName,
    setPresetName,
    presetPreamp,
    setPresetPreamp,
    presetText,
    presetStatus,
    exportCsv,
    exportJson,
    copyPreset,
    exportPresetTxt,
  } = state;

  const sectionRef = useRef<HTMLElement>(null);
  const prevCurveLen = useRef(0);

  useEffect(() => {
    if (curve.length > 0 && prevCurveLen.current === 0) {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    prevCurveLen.current = curve.length;
  }, [curve.length]);

  if (!curve.length) return null;

  return (
    <section className="results" ref={sectionRef}>
      <div className="panel">
        <div className="panel-header">
          <h2>Orientacyjne wskazówki do ręcznego EQ</h2>
          <div className="button-row">
            <button type="button" className="secondary" onClick={exportCsv}>
              Eksport CSV
            </button>
            <button type="button" className="secondary" onClick={exportJson}>
              Eksport JSON
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Typ</th>
                <th>Częstotliwość</th>
                <th>Odchyłka</th>
                <th>Sugestia</th>
                <th>Orientacyjne Q</th>
                <th>Uwagi</th>
              </tr>
            </thead>
            <tbody>
              {!suggestions.length ? (
                <tr>
                  <td colSpan={6} className="note">
                    Nie znaleziono wyraźnych lokalnych pików lub dołków przekraczających progi
                    sugestii. Obejrzyj wykres i ewentualnie wykonaj dłuższy pomiar.
                  </td>
                </tr>
              ) : (
                suggestions.map((item) => {
                  let label = '';
                  let badgeClass = '';
                  let suggestionText = '';

                  if (item.kind === 'cut') {
                    label = 'Pik';
                    badgeClass = 'cut';
                    suggestionText = `${item.gain!.toFixed(1)} dB`;
                  } else if (item.kind === 'boost') {
                    label = 'Dołek';
                    badgeClass = 'boost';
                    suggestionText = `+${item.gain!.toFixed(1)} dB maks.`;
                  } else {
                    label = 'Możliwy null';
                    badgeClass = 'null';
                    suggestionText = 'Nie podbijaj';
                  }

                  return (
                    <tr key={`${item.kind}-${item.frequency}`}>
                      <td>
                        <span className={`pill ${badgeClass}`}>{label}</span>
                      </td>
                      <td>{formatFrequency(item.frequency)}</td>
                      <td>{formatDb(item.deviation)}</td>
                      <td>{suggestionText}</td>
                      <td>{item.q.toFixed(2)}</td>
                      <td className="note">{item.note}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="panel-body">
          <div className="preset-box">
            <h3>Preset tekstowy do equalizera</h3>
            <p className="helper">
              Format zgodny z pokazanym przykładem:{' '}
              <code>Name / Preamp / Filter / PK / Fc / Gain / BW Oct</code>. Prawdopodobne nulle
              są zapisywane jako <strong>OFF</strong>, ponieważ ich podbijanie zwykle nie pomaga.
            </p>

            <div className="two">
              <label>
                Nazwa presetu
                <input
                  type="text"
                  value={presetName}
                  maxLength={80}
                  onChange={(e) => setPresetName(e.target.value)}
                />
              </label>
              <label>
                Preamp [dB]
                <input
                  type="number"
                  value={presetPreamp}
                  min={-30}
                  max={12}
                  step={0.1}
                  onChange={(e) => setPresetPreamp(Number(e.target.value))}
                />
              </label>
            </div>

            <label style={{ marginTop: 14 }}>
              Gotowy tekst
              <textarea readOnly spellCheck={false} value={presetText} />
            </label>

            <div className="preset-actions">
              <button type="button" className="primary" onClick={() => void copyPreset()}>
                Kopiuj preset
              </button>
              <button type="button" className="secondary" onClick={exportPresetTxt}>
                Pobierz TXT
              </button>
              <span className="preset-status">{presetStatus}</span>
            </div>
          </div>

          <p className="footer-note">
            Sugestie są punktem wyjścia, a nie automatyczną kalibracją. Najpierw redukuj szerokie
            piki. Głębokie dołki często wynikają z wygaszania fal i zwykle nie powinny być mocno
            podbijane korektorem. Po każdej zmianie wykonaj ponowny pomiar.
          </p>
        </div>
      </div>
    </section>
  );
}

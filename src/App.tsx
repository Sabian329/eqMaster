import { useRoomEq } from './hooks/useRoomEq';
import { ConfigPanel } from './components/ConfigPanel';
import { ChartPanel } from './components/ChartPanel';
import { ResultsPanel } from './components/ResultsPanel';

function App() {
  const state = useRoomEq();
  const isElectron = window.electronAPI?.isElectron === true;

  return (
    <main className="shell">
      <header>
        <div>
          <h1>Room EQ Measure</h1>
          <p className="subtitle">
            Aplikacja do pomiaru odpowiedzi częstotliwościowej głośników i pomieszczenia.
            Odtwarza sweep, nagrywa mikrofon, analizuje wynik i podpowiada orientacyjne ustawienia
            ręcznego EQ.
          </p>
        </div>
        <div className="badge" style={{ color: state.environmentBadge.color }}>
          {state.environmentBadge.text}
        </div>
      </header>

      <div className="notice">
        <strong>Bezpieczeństwo:</strong> zacznij od niskiej głośności. Wyłącz direct monitoring w
        interfejsie, odsuń uszy od głośników i nie używaj słuchawek.
        {isElectron ? (
          <>
            {' '}
            Aplikacja natywna poprosi o dostęp do mikrofonu przy pierwszym pomiarze — zezwól w
            ustawieniach macOS, jeśli pomiar się nie uruchomi.
          </>
        ) : (
          <>
            {' '}
            Do pomiaru w przeglądarce zalecany jest Chrome/Edge oraz uruchomienie strony przez{' '}
            <code>https://</code> lub <code>localhost</code>.
          </>
        )}
      </div>

      <section className="grid">
        <ConfigPanel state={state} />
        <ChartPanel state={state} />
      </section>

      <ResultsPanel state={state} />
    </main>
  );
}

export default App;

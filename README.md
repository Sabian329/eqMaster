# Room EQ Measure

Natywna aplikacja macOS (Electron + React + Vite + TypeScript) do pomiaru odpowiedzi częstotliwościowej głośników i pomieszczenia.

## Wymagania

- Node.js 20.19+ lub 22.12+
- macOS (do budowania paczki `.app` / `.dmg`)

## Uruchomienie deweloperskie (Electron)

```bash
cd room-eq-app
npm install
npm run dev:electron
```

Uruchamia serwer Vite i okno aplikacji Electron z hot reload.

## Uruchomienie tylko w przeglądarce

```bash
npm run dev
```

## Budowanie aplikacji macOS

```bash
npm run dist:dir
```

Wynik: `release/mac-arm64/Room EQ Measure.app` (lub `mac-x64` na Intelu).

Instalator DMG:

```bash
npm run dist
```

Wynik: `release/Room EQ Measure-1.0.0.dmg`.

Przy pierwszym uruchomieniu niespodpisanego buildu macOS może wymagać: **System Settings → Privacy & Security → Open Anyway**.

> **Uwaga:** jeśli uruchamiasz z terminala w Cursorze i okno się nie otwiera, użyj zwykłego Terminal.app albo skorzystaj ze skryptów `npm run start` / `npm run dev:electron` — automatycznie wyłączają one zmienną `ELECTRON_RUN_AS_NODE`, która blokuje start Electrona w niektórych IDE.

## Uprawnienia

Aplikacja prosi o dostęp do mikrofonu (wymagane do pomiaru). Upewnij się, że mikrofon jest włączony w **System Settings → Privacy & Security → Microphone**.

## Skrypty

| Polecenie | Opis |
|-----------|------|
| `npm run dev:electron` | Dev z oknem Electron |
| `npm run dev` | Dev w przeglądarce |
| `npm run build` | Build renderera + procesu Electron |
| `npm run dist:dir` | Paczka `.app` bez DMG |
| `npm run dist` | `.app` + `.dmg` + `.zip` |
# eqMaster

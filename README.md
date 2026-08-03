# Room EQ Measure

Native macOS app (Electron + React + Vite + TypeScript) for measuring speaker and room frequency response.

## Requirements

- Node.js 20.19+ or 22.12+
- macOS (for building `.app` / `.dmg` packages)

## Electron development

```bash
npm install
npm run dev:electron
```

Starts the Vite dev server and an Electron window with hot reload.

## Browser-only development

```bash
npm run dev
```

## Building the macOS app

```bash
npm run dist:dir
```

Output: `release/mac-arm64/Room EQ Measure.app` (or `mac-x64` on Intel).

DMG installer:

```bash
npm run dist
```

Output: `release/Room EQ Measure-1.0.0.dmg`.

On first launch, an unsigned macOS build may require: **System Settings → Privacy & Security → Open Anyway**.

> **Note:** if you run from a terminal inside Cursor and the window does not open, use Terminal.app or run `npm run start` / `npm run dev:electron` — those scripts unset `ELECTRON_RUN_AS_NODE`, which blocks Electron in some IDEs.

## Permissions

The app requests microphone access (required for measurement). Make sure the microphone is enabled in **System Settings → Privacy & Security → Microphone**.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:electron` | Dev with Electron window |
| `npm run dev` | Dev in browser |
| `npm run build` | Build renderer + Electron process |
| `npm run dist:dir` | `.app` package without DMG |
| `npm run dist` | `.app` + `.dmg` + `.zip` |

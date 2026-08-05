import type { ChannelMode, CurvePoint, MeasurementMeta, Suggestion } from '../types';
import { buildCorrectedCurve } from './correctedCurve';
import { sanitizeCurve } from './sanitizeCurve';

export interface MockMeasurementOptions {
  fMin: number;
  fMax: number;
  smoothing: number;
  durationSeconds: number;
  levelDb: number;
  channel: ChannelMode;
  runIndex: number;
  seedSalt?: number;
  inputLabel?: string;
  outputLabel?: string;
}

type MockFeature = {
  frequency: number;
  db: number;
  width: number;
};

/** Deterministic PRNG — repeatable per run, different between runs. */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function gaussianBump(
  frequency: number,
  center: number,
  logWidth: number,
  amplitude: number,
): number {
  const x = (Math.log10(frequency) - Math.log10(center)) / logWidth;
  return amplitude * Math.exp(-0.5 * x * x);
}

function logFrequencyBetween(rng: () => number, fMin: number, fMax: number): number {
  const logMin = Math.log10(fMin);
  const logMax = Math.log10(fMax);
  return 10 ** (logMin + rng() * (logMax - logMin));
}

/** Broad room envelope — bass lift, slight upper-mid hump, HF rolloff. */
function buildRoomEnvelope(frequency: number, runIndex: number): number {
  const runTilt = (runIndex - 1) * 0.35;
  let db = 0;

  db += gaussianBump(frequency, 58, 0.42, 5.2 - runTilt * 0.2);
  db += gaussianBump(frequency, 38, 0.28, 2.8);
  db += gaussianBump(frequency, 280, 0.55, 1.4);
  db -= gaussianBump(frequency, 900, 0.65, 1.8);
  db += gaussianBump(frequency, 3200, 0.75, 1.2);
  db -= gaussianBump(frequency, 9500, 0.45, 2.6 + runTilt * 0.15);
  db -= gaussianBump(frequency, 16_000, 0.35, 3.5);

  return db;
}

/** Random modal peaks/nulls — dense & irregular in bass, sparser upward. */
function buildMockFeatures(
  fMin: number,
  fMax: number,
  runIndex: number,
  seedSalt = 0,
): MockFeature[] {
  const rng = createSeededRandom(
    0x9e37_79b9 + runIndex * 7_919 + seedSalt * 0x85eb_ca6b,
  );
  const features: MockFeature[] = [];

  const bassModes = 8 + Math.floor(rng() * 5);
  for (let index = 0; index < bassModes; index += 1) {
    const frequency = logFrequencyBetween(rng, Math.max(fMin, 38), Math.min(fMax, 280));
    const isNull = rng() > 0.42;
    const db = isNull
      ? -(3.5 + rng() * 9.5)
      : 2.5 + rng() * 8.5;
    const width = 0.022 + rng() * 0.055;
    features.push({ frequency, db, width });
  }

  const lowMidModes = 5 + Math.floor(rng() * 4);
  for (let index = 0; index < lowMidModes; index += 1) {
    const frequency = logFrequencyBetween(rng, 220, Math.min(fMax, 900));
    const isNull = rng() > 0.55;
    const db = isNull
      ? -(2 + rng() * 6)
      : 1.5 + rng() * 5.5;
    const width = 0.035 + rng() * 0.08;
    features.push({ frequency, db, width });
  }

  const midModes = 4 + Math.floor(rng() * 5);
  for (let index = 0; index < midModes; index += 1) {
    const frequency = logFrequencyBetween(rng, 700, Math.min(fMax, 4500));
    const isNull = rng() > 0.58;
    const db = isNull
      ? -(1.5 + rng() * 4.5)
      : 1 + rng() * 4;
    const width = 0.05 + rng() * 0.12;
    features.push({ frequency, db, width });
  }

  if (fMax >= 5000) {
    const trebleModes = 2 + Math.floor(rng() * 3);
    for (let index = 0; index < trebleModes; index += 1) {
      const frequency = logFrequencyBetween(rng, 4500, Math.min(fMax, 14_000));
      const db = rng() > 0.65
        ? -(1 + rng() * 3)
        : 0.8 + rng() * 2.5;
      const width = 0.08 + rng() * 0.15;
      features.push({ frequency, db, width });
    }
  }

  return features;
}

/** Gentle 1/N-oct smoothing to mimic analyzed curve (not a perfect comb). */
function smoothMockCurve(points: CurvePoint[], fraction: number): CurvePoint[] {
  if (fraction <= 0) return points.map((point) => ({ ...point }));

  const sigmaOctaves = 1 / fraction / 2.355;
  const maximumDistance = sigmaOctaves * 2.5;

  return points.map((point) => {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const candidate of points) {
      const distance = Math.log2(candidate.frequency / point.frequency);
      if (Math.abs(distance) > maximumDistance) continue;

      const weight = Math.exp(-0.5 * (distance / sigmaOctaves) ** 2);
      weightedSum += candidate.db * weight;
      totalWeight += weight;
    }

    return {
      frequency: point.frequency,
      db: totalWeight > 0 ? weightedSum / totalWeight : point.db,
    };
  });
}

function buildMockCurve(options: MockMeasurementOptions): CurvePoint[] {
  const usableMax = Math.min(options.fMax, 20000);
  const pointCount = 520;
  const seedSalt = options.seedSalt ?? 0;
  const rng = createSeededRandom(
    0x51ed_2701 + options.runIndex * 13_131 + seedSalt * 9_973,
  );
  const runShift = (options.runIndex - 1) * 0.22;
  const mockFeatures = buildMockFeatures(
    options.fMin,
    usableMax,
    options.runIndex,
    seedSalt,
  );
  const raw: CurvePoint[] = [];

  for (let index = 0; index < pointCount; index += 1) {
    const ratio = index / (pointCount - 1);
    const frequency = options.fMin * Math.pow(usableMax / options.fMin, ratio);

    let db = buildRoomEnvelope(frequency, options.runIndex);

    for (const feature of mockFeatures) {
      if (feature.frequency < options.fMin * 0.85 || feature.frequency > usableMax * 1.08) {
        continue;
      }

      const runScale =
        feature.db > 0 ? 1 - runShift * 0.05 : 1 + runShift * 0.05;

      db += gaussianBump(
        frequency,
        feature.frequency,
        feature.width,
        feature.db * runScale,
      );
    }

    const ripple =
      Math.sin(Math.log2(frequency / 90) * 5.1 + options.runIndex) * 0.35 +
      Math.sin(Math.log2(frequency / 220) * 2.7 + options.runIndex * 1.3) * 0.55;

    db += ripple;
    db += (rng() - 0.5) * 0.45;

    raw.push({
      frequency,
      db: Math.max(-54, Math.min(18, db)),
    });
  }

  const normalizationValues = raw
    .filter((point) => point.frequency >= 500 && point.frequency <= 2000)
    .map((point) => point.db);
  const normalization =
    normalizationValues.length > 0
      ? normalizationValues.sort((a, b) => a - b)[
          Math.floor(normalizationValues.length / 2)
        ]
      : 0;

  const normalized = raw.map((point) => ({
    frequency: point.frequency,
    db: point.db - normalization,
  }));

  const smoothFraction = Math.max(6, options.smoothing);
  const smoothed = smoothMockCurve(normalized, smoothFraction);

  return sanitizeCurve(smoothed);
}

export function createMockMeasurementRun(options: MockMeasurementOptions): {
  curve: CurvePoint[];
  measurementMeta: MeasurementMeta;
} {
  const curve = buildMockCurve(options);
  const usableMax = Math.min(options.fMax, 20000);

  return {
    curve,
    measurementMeta: {
      date: new Date().toISOString(),
      sampleRate: 48000,
      samples: Math.round(options.durationSeconds * 48000),
      peakDb: -14.2 - options.runIndex * 0.3,
      noiseDb: -58.4,
      fMin: options.fMin,
      fMax: usableMax,
      durationSeconds: options.durationSeconds,
      smoothing: options.smoothing,
      levelDb: options.levelDb,
      channel: options.channel,
      inputLabel: options.inputLabel ?? 'Mock microphone',
      outputLabel: options.outputLabel ?? 'Mock output',
      trackSettings: {},
      fftSize: 65536,
      calibrationPoints: 0,
      recorderMode: 'mock',
    },
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function runMockMeasurement(
  options: MockMeasurementOptions,
  onStatus: (text: string, progress: number) => void,
): Promise<{
  curve: CurvePoint[];
  suggestions: Suggestion[];
  measurementMeta: MeasurementMeta;
}> {
  onStatus(`Mock sweep ${options.runIndex} — preparing…`, 8);
  await delay(250);
  onStatus(`Mock sweep ${options.runIndex} — playing (simulated)…`, 28);
  await delay(350);
  onStatus(`Mock sweep ${options.runIndex} — analyzing…`, 72);
  await delay(400);

  const { curve, measurementMeta } = createMockMeasurementRun(options);

  onStatus(`Mock measurement ${options.runIndex} complete`, 100);

  return {
    curve,
    suggestions: [],
    measurementMeta,
  };
}

export interface MockVerificationOptions extends MockMeasurementOptions {
  baselineCurve: CurvePoint[];
  suggestions: Suggestion[];
  preampDb: number;
}

export async function runMockVerification(
  options: MockVerificationOptions,
  onStatus: (text: string, progress: number) => void,
): Promise<{
  curve: CurvePoint[];
  measurementMeta: MeasurementMeta;
}> {
  onStatus('Mock verification — applying EQ (simulated)…', 12);
  await delay(300);
  onStatus('Mock verification — re-measuring with EQ…', 45);
  await delay(450);
  onStatus('Mock verification — analyzing…', 78);
  await delay(350);

  const corrected = buildCorrectedCurve(
    options.baselineCurve,
    options.suggestions,
    options.preampDb,
  );

  const verifyRng = createSeededRandom(0xdead_beef + options.runIndex * 997);
  const runShift = (options.runIndex - 1) * 0.18;
  const curve = sanitizeCurve(
    corrected.map((point) => ({
      frequency: point.frequency,
      db: Math.max(
        -54,
        Math.min(
          18,
          point.db + (verifyRng() - 0.5) * (0.6 + runShift),
        ),
      ),
    })),
  );

  const { measurementMeta: baseMeta } = createMockMeasurementRun(options);
  const measurementMeta: MeasurementMeta = {
    ...baseMeta,
    date: new Date().toISOString(),
    peakDb: baseMeta.peakDb - 1.2,
    verificationMode: true,
  };

  onStatus('Mock verification complete', 100);

  return { curve, measurementMeta };
}

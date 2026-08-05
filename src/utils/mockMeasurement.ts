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
  inputLabel?: string;
  outputLabel?: string;
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

/** Log-spaced peaks/dips — narrow enough to stay isolated for up to 16 bands. */
function buildMockFeatures(): Array<{ frequency: number; db: number; width: number }> {
  const startHz = 45;
  const endHz = 16500;
  const count = 17;
  const features: Array<{ frequency: number; db: number; width: number }> = [];

  for (let index = 0; index < count; index++) {
    const ratio = index / (count - 1);
    const frequency = startHz * Math.pow(endHz / startHz, ratio);
    const isPeak = index % 2 === 0;
    const tier = index % 3;

    let db: number;
    if (!isPeak && index === 5) {
      db = -9.2;
    } else if (isPeak) {
      db = 5.2 + tier * 0.35;
    } else {
      db = -(5 + tier * 0.45);
    }

    features.push({ frequency, db, width: 0.055 });
  }

  return features;
}

function buildMockCurve(options: MockMeasurementOptions): CurvePoint[] {
  const usableMax = Math.min(options.fMax, 20000);
  const pointCount = 520;
  const runShift = (options.runIndex - 1) * 0.25;
  const baseline: CurvePoint[] = [];

  for (let index = 0; index < pointCount; index++) {
    const ratio = index / (pointCount - 1);
    const frequency = options.fMin * Math.pow(usableMax / options.fMin, ratio);
    const logProgress =
      (Math.log10(frequency) - Math.log10(options.fMin)) /
      (Math.log10(usableMax) - Math.log10(options.fMin));

    baseline.push({
      frequency,
      db: -logProgress * 0.6,
    });
  }

  const normalizationValues = baseline
    .filter((point) => point.frequency >= 500 && point.frequency <= 2000)
    .map((point) => point.db);
  const normalization =
    normalizationValues.length > 0
      ? normalizationValues.sort((a, b) => a - b)[
          Math.floor(normalizationValues.length / 2)
        ]
      : 0;

  const mockFeatures = buildMockFeatures();
  const curve: CurvePoint[] = [];

  for (const point of baseline) {
    let db = point.db - normalization;

    for (const feature of mockFeatures) {
      if (
        feature.frequency < options.fMin * 0.9 ||
        feature.frequency > usableMax * 1.05
      ) {
        continue;
      }
      const runScale =
        feature.db > 0 ? 1 - runShift * 0.04 : 1 + runShift * 0.04;
      db += gaussianBump(
        point.frequency,
        feature.frequency,
        feature.width,
        feature.db * runScale,
      );
    }

    curve.push({
      frequency: point.frequency,
      db: Math.max(-54, Math.min(18, db)),
    });
  }

  const cleaned = sanitizeCurve(curve);
  return cleaned;
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

  const runShift = (options.runIndex - 1) * 0.15;
  const curve = sanitizeCurve(
    corrected.map((point) => ({
      frequency: point.frequency,
      db: Math.max(-54, Math.min(18, point.db + (Math.random() - 0.5) * runShift)),
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

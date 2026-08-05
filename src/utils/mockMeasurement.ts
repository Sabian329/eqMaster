import type { ChannelMode, CurvePoint, MeasurementMeta, Suggestion } from '../types';
import {
  createMockMeasurementAudioFrame,
  type MeasurementAudioFrame,
} from '../audio/measurementAudioVisual';
import {
  createMeasurementAbortError,
  throwIfMeasurementAborted,
  waitForAbort,
} from '../audio/measurementAbort';
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
  /** Library preset id — presets 5–9 use fixed stress-test profiles. */
  presetId?: number;
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

type ResonantPresetId = 5 | 6 | 7 | 8 | 9;

type PeakDef = [frequency: number, db: number, width: number];

function isResonantPreset(presetId?: number): presetId is ResonantPresetId {
  return (
    presetId === 5 ||
    presetId === 6 ||
    presetId === 7 ||
    presetId === 8 ||
    presetId === 9
  );
}

function pushPeaks(
  features: MockFeature[],
  peaks: PeakDef[],
  fMin: number,
  fMax: number,
  runIndex: number,
  runShiftScale = 1,
): void {
  const runShift = (runIndex - 1) * 0.012 * runShiftScale;
  const amplitudeScale = 1 - (runIndex - 1) * 0.035;

  for (const [frequency, db, width] of peaks) {
    if (frequency < fMin * 0.9 || frequency > fMax * 1.05) continue;
    const runDetune = 2 ** (runShift * (frequency < 500 ? 1.15 : 0.55));
    features.push({
      frequency: frequency * runDetune,
      db: db * amplitudeScale,
      width,
    });
  }
}

function pushNulls(
  features: MockFeature[],
  nulls: PeakDef[],
  fMin: number,
  fMax: number,
  runIndex: number,
): void {
  const runShift = (runIndex - 1) * 0.012;
  for (const [frequency, db, width] of nulls) {
    if (frequency < fMin * 0.9 || frequency > fMax * 1.05) continue;
    features.push({
      frequency: frequency * 2 ** runShift,
      db: db * (1 + runShift * 0.08),
      width,
    });
  }
}

/**
 * Mock 5 — corner placement nightmare:
 * strong axial modes, deep SBIR nulls, wall comb filtering, jagged mids/treble.
 */
function buildCornerChaosFeatures(
  fMin: number,
  fMax: number,
  runIndex: number,
): MockFeature[] {
  const features: MockFeature[] = [];

  // Corner-reinforced axial / tangential / oblique bass modes (very dense).
  const peaks: PeakDef[] = [
    [32, 10.5, 0.018],
    [38, 8.8, 0.017],
    [44, 11.2, 0.016],
    [51, 9.4, 0.018],
    [58, 12.0, 0.015],
    [67, 8.2, 0.019],
    [74, 10.8, 0.016],
    [83, 7.6, 0.02],
    [92, 11.5, 0.015],
    [103, 9.1, 0.018],
    [116, 12.4, 0.014],
    [128, 10.2, 0.015],
    [141, 8.7, 0.017],
    [156, 11.0, 0.015],
    [172, 7.9, 0.019],
    [190, 9.6, 0.017],
    [210, 6.8, 0.021],
    [235, 8.4, 0.019],
    [262, 7.2, 0.022],
    [295, 9.0, 0.02],
    [330, 6.4, 0.024],
    [370, 8.1, 0.022],
    [415, 5.9, 0.025],
    [465, 7.5, 0.023],
    [520, 6.2, 0.026],
    [585, 5.4, 0.028],
    [660, 7.0, 0.025],
    [740, 5.1, 0.029],
    [830, 6.6, 0.027],
    [930, 4.8, 0.03],
    [1050, 6.3, 0.028],
    [1180, 5.5, 0.03],
    [1340, 4.6, 0.032],
    [1520, 6.0, 0.03],
    [1720, 5.2, 0.033],
    [1950, 4.4, 0.035],
    [2200, 5.8, 0.032],
    [2500, 4.9, 0.034],
    [2850, 5.5, 0.033],
    [3250, 4.2, 0.036],
    [3700, 5.1, 0.035],
    [4200, 3.9, 0.038],
    [4800, 4.7, 0.036],
    [5450, 3.6, 0.04],
    [6200, 4.4, 0.038],
    [7100, 3.3, 0.042],
    [8100, 4.0, 0.04],
    [9200, 3.1, 0.044],
    [10_500, 3.7, 0.042],
    [12_000, 2.8, 0.046],
    [13_800, 3.4, 0.044],
    [15_800, 2.5, 0.048],
    [18_000, 2.9, 0.046],
  ];

  // Deep corner SBIR / boundary / comb nulls — uncorrectable and brutal.
  const nulls: PeakDef[] = [
    [48, -11.5, 0.014],
    [63, -9.8, 0.015],
    [79, -12.2, 0.013],
    [97, -10.4, 0.015],
    [112, -8.6, 0.017],
    [134, -13.0, 0.012],
    [148, -9.2, 0.016],
    [168, -11.0, 0.014],
    [198, -10.6, 0.015],
    [225, -8.4, 0.018],
    [255, -12.5, 0.013],
    [310, -9.0, 0.017],
    [355, -10.8, 0.015],
    [400, -7.6, 0.02],
    [455, -11.4, 0.014],
    [510, -8.2, 0.019],
    [575, -10.0, 0.016],
    [650, -7.4, 0.021],
    [780, -9.6, 0.017],
    [900, -11.8, 0.014],
    [1020, -8.0, 0.02],
    [1250, -9.4, 0.018],
    [1480, -7.2, 0.022],
    [1750, -10.2, 0.016],
    [2100, -8.8, 0.019],
    [2450, -6.8, 0.023],
    [2900, -9.8, 0.017],
    [3400, -7.5, 0.021],
    [4000, -10.5, 0.016],
    [4700, -6.6, 0.024],
    [5600, -8.6, 0.02],
    [6800, -7.0, 0.023],
    [8200, -9.2, 0.018],
    [9800, -6.4, 0.025],
    [11_500, -8.0, 0.021],
    [14_000, -5.8, 0.028],
    [16_500, -7.4, 0.024],
  ];

  pushPeaks(features, peaks, fMin, fMax, runIndex, 1.25);
  pushNulls(features, nulls, fMin, fMax, runIndex);
  return features;
}

/** Corner room envelope — heavy bass boom, scooped lower mids, harsh reflected treble. */
function buildCornerRoomEnvelope(frequency: number, runIndex: number): number {
  const runTilt = (runIndex - 1) * 0.25;
  let db = 0;
  db += gaussianBump(frequency, 45, 0.5, 7.5 - runTilt * 0.15);
  db += gaussianBump(frequency, 70, 0.35, 4.8);
  db -= gaussianBump(frequency, 220, 0.55, 3.2);
  db -= gaussianBump(frequency, 700, 0.6, 2.4);
  db += gaussianBump(frequency, 2_400, 0.7, 2.8);
  db += gaussianBump(frequency, 5_500, 0.55, 2.2 + runTilt * 0.1);
  db -= gaussianBump(frequency, 11_000, 0.4, 1.8);
  db -= gaussianBump(frequency, 17_000, 0.32, 3.2);
  return db;
}

/** Mock 6 — dense comb across the band (incl. strengthened 130 Hz). */
function buildDenseResonantFeatures(
  fMin: number,
  fMax: number,
  runIndex: number,
): MockFeature[] {
  const features: MockFeature[] = [];
  const peaks: PeakDef[] = [
    [45, 8.5, 0.022],
    [52, 6.8, 0.02],
    [61, 9.2, 0.024],
    [73, 7.4, 0.023],
    [88, 5.8, 0.026],
    [105, 6.2, 0.025],
    [122, 9.5, 0.021],
    [130, 11.2, 0.019],
    [138, 8.8, 0.021],
    [155, 7.1, 0.024],
    [178, 5.4, 0.027],
    [210, 4.2, 0.03],
    [245, 5.6, 0.028],
    [290, 3.8, 0.032],
    [340, 6.1, 0.029],
    [410, 4.4, 0.034],
    [520, 5.2, 0.031],
    [640, 3.6, 0.036],
    [750, 4.7, 0.033],
    [920, 3.7, 0.035],
    [1150, 4.1, 0.038],
    [1450, 3.2, 0.04],
    [1850, 5.3, 0.036],
    [2300, 4.6, 0.039],
    [2900, 3.5, 0.042],
    [3600, 4.2, 0.041],
    [4200, 3.1, 0.044],
    [5500, 2.8, 0.046],
    [6800, 3.2, 0.048],
    [8200, 2.4, 0.05],
    [10500, 2.9, 0.052],
  ];
  pushPeaks(features, peaks, fMin, fMax, runIndex);
  pushNulls(
    features,
    [
      [192, -8.5, 0.02],
      [880, -5.2, 0.025],
    ],
    fMin,
    fMax,
    runIndex,
  );
  return features;
}

/** Mock 7 — heavy 130 Hz wall + strong mids + soprano peaks. */
function build130MidSopranoFeatures(
  fMin: number,
  fMax: number,
  runIndex: number,
): MockFeature[] {
  const features: MockFeature[] = [];
  pushPeaks(
    features,
    [
      [118, 10.2, 0.018],
      [125, 11.5, 0.017],
      [130, 12.8, 0.016],
      [136, 11.0, 0.017],
      [143, 9.4, 0.019],
      [152, 7.2, 0.02],
    ],
    fMin,
    fMax,
    runIndex,
    1.2,
  );
  pushPeaks(
    features,
    [
      [680, 7.8, 0.028],
      [920, 8.4, 0.026],
      [1180, 7.2, 0.027],
      [1550, 6.8, 0.029],
      [2100, 6.2, 0.031],
      [2650, 5.4, 0.033],
    ],
    fMin,
    fMax,
    runIndex,
  );
  pushPeaks(
    features,
    [
      [6200, 5.8, 0.038],
      [7800, 6.4, 0.04],
      [9500, 5.6, 0.042],
      [11500, 5.2, 0.044],
      [14000, 4.6, 0.046],
    ],
    fMin,
    fMax,
    runIndex,
  );
  pushNulls(features, [[198, -7.5, 0.019]], fMin, fMax, runIndex);
  return features;
}

/** Mock 8 — variant B: shifted mid/treble clusters, 130 Hz still dominant. */
function build130MidSopranoVariantB(
  fMin: number,
  fMax: number,
  runIndex: number,
): MockFeature[] {
  const features: MockFeature[] = [];
  pushPeaks(
    features,
    [
      [127, 11.8, 0.017],
      [132, 13.2, 0.015],
      [139, 10.6, 0.018],
      [148, 8.0, 0.02],
    ],
    fMin,
    fMax,
    runIndex,
    1.35,
  );
  pushPeaks(
    features,
    [
      [540, 8.2, 0.03],
      [760, 7.6, 0.028],
      [1020, 8.8, 0.026],
      [1680, 7.4, 0.03],
      [2450, 6.6, 0.032],
      [3100, 5.8, 0.034],
      [3800, 5.0, 0.036],
    ],
    fMin,
    fMax,
    runIndex,
  );
  pushPeaks(
    features,
    [
      [5800, 6.2, 0.039],
      [7200, 7.0, 0.041],
      [8800, 6.6, 0.043],
      [10800, 5.8, 0.045],
      [13200, 5.4, 0.047],
      [16500, 4.8, 0.05],
    ],
    fMin,
    fMax,
    runIndex,
  );
  pushNulls(
    features,
    [
      [890, -6.8, 0.022],
      [4200, -5.5, 0.028],
    ],
    fMin,
    fMax,
    runIndex,
  );
  return features;
}

/** Mock 9 — max stress: all zones simultaneously, highest peak density. */
function build130MidSopranoMaxStress(
  fMin: number,
  fMax: number,
  runIndex: number,
): MockFeature[] {
  const features: MockFeature[] = [];
  pushPeaks(
    features,
    [
      [121, 11.0, 0.017],
      [130, 13.8, 0.014],
      [140, 12.2, 0.016],
      [165, 8.5, 0.02],
      [195, 6.8, 0.022],
    ],
    fMin,
    fMax,
    runIndex,
    1.5,
  );
  pushPeaks(
    features,
    [
      [450, 9.0, 0.028],
      [650, 8.6, 0.027],
      [850, 9.2, 0.026],
      [1100, 8.8, 0.025],
      [1350, 7.8, 0.027],
      [1750, 7.2, 0.029],
      [2200, 6.8, 0.03],
      [2800, 6.2, 0.032],
      [3500, 5.6, 0.034],
    ],
    fMin,
    fMax,
    runIndex,
  );
  pushPeaks(
    features,
    [
      [5000, 6.8, 0.037],
      [6500, 7.4, 0.039],
      [8000, 7.8, 0.041],
      [10000, 7.2, 0.043],
      [12500, 6.6, 0.045],
      [15000, 6.0, 0.047],
      [18000, 5.2, 0.05],
    ],
    fMin,
    fMax,
    runIndex,
  );
  pushNulls(
    features,
    [
      [188, -9.0, 0.018],
      [740, -6.2, 0.024],
      [9600, -4.8, 0.035],
    ],
    fMin,
    fMax,
    runIndex,
  );
  return features;
}

function buildResonantMockFeatures(
  presetId: ResonantPresetId,
  fMin: number,
  fMax: number,
  runIndex: number,
): MockFeature[] {
  switch (presetId) {
    case 5:
      return buildCornerChaosFeatures(fMin, fMax, runIndex);
    case 7:
      return build130MidSopranoFeatures(fMin, fMax, runIndex);
    case 8:
      return build130MidSopranoVariantB(fMin, fMax, runIndex);
    case 9:
      return build130MidSopranoMaxStress(fMin, fMax, runIndex);
    case 6:
    default:
      return buildDenseResonantFeatures(fMin, fMax, runIndex);
  }
}

/** Flatter baseline so resonances read clearly on Mock 6. */
function buildResonantRoomEnvelope(frequency: number, runIndex: number): number {
  const runTilt = (runIndex - 1) * 0.2;
  let db = 0;
  db += gaussianBump(frequency, 80, 0.55, 1.2);
  db -= gaussianBump(frequency, 12_000, 0.4, 1.8 + runTilt * 0.1);
  return db;
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
  const resonantPreset = isResonantPreset(options.presetId) ? options.presetId : null;
  const mockFeatures = resonantPreset
    ? buildResonantMockFeatures(
        resonantPreset,
        options.fMin,
        usableMax,
        options.runIndex,
      )
    : buildMockFeatures(
        options.fMin,
        usableMax,
        options.runIndex,
        seedSalt,
      );
  const raw: CurvePoint[] = [];

  for (let index = 0; index < pointCount; index += 1) {
    const ratio = index / (pointCount - 1);
    const frequency = options.fMin * Math.pow(usableMax / options.fMin, ratio);

    let db =
      resonantPreset === 5
        ? buildCornerRoomEnvelope(frequency, options.runIndex)
        : resonantPreset
          ? buildResonantRoomEnvelope(frequency, options.runIndex)
          : buildRoomEnvelope(frequency, options.runIndex);

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
      resonantPreset === 5
        ? Math.sin(Math.log2(frequency / 55) * 9.5 + options.runIndex) * 0.85 +
          Math.sin(Math.log2(frequency / 140) * 6.2 + options.runIndex * 1.7) * 0.7 +
          Math.sin(Math.log2(frequency / 900) * 4.4 + options.runIndex * 0.9) * 0.55 +
          Math.sin(Math.log2(frequency / 3_500) * 7.1 + options.runIndex * 2.1) * 0.45
        : resonantPreset
          ? Math.sin(Math.log2(frequency / 120) * 3.2 + options.runIndex) * 0.15
          : Math.sin(Math.log2(frequency / 90) * 5.1 + options.runIndex) * 0.35 +
            Math.sin(Math.log2(frequency / 220) * 2.7 + options.runIndex * 1.3) * 0.55;

    db += ripple;
    db +=
      (rng() - 0.5) *
      (resonantPreset === 5 ? 0.75 : resonantPreset ? 0.28 : 0.45);

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

  // Keep Mock 5 intentionally jagged — minimal smoothing only.
  const smoothFraction =
    resonantPreset === 5
      ? Math.max(48, options.smoothing)
      : resonantPreset
        ? Math.max(12, options.smoothing)
        : Math.max(6, options.smoothing);
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

async function runMockPhase(
  ms: number,
  phase: 'quiet' | 'sweep' | 'decay',
  onAudioFrame?: (frame: MeasurementAudioFrame) => void,
  abortSignal?: AbortSignal,
): Promise<void> {
  throwIfMeasurementAborted(abortSignal);

  if (!onAudioFrame) {
    await Promise.race([
      delay(ms),
      waitForAbort(abortSignal),
    ]);
    return;
  }

  const started = performance.now();
  await Promise.race([
    new Promise<void>((resolve, reject) => {
      const tick = () => {
        const elapsed = performance.now() - started;
        const t = Math.min(1, elapsed / ms);
        onAudioFrame(createMockMeasurementAudioFrame(phase, t));
        if (elapsed >= ms) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      abortSignal?.addEventListener(
        'abort',
        () => {
          reject(createMeasurementAbortError());
        },
        { once: true },
      );
    }),
    waitForAbort(abortSignal),
  ]);

  throwIfMeasurementAborted(abortSignal);
}

export async function runMockMeasurement(
  options: MockMeasurementOptions,
  onStatus: (text: string, progress: number) => void,
  onAudioFrame?: (frame: MeasurementAudioFrame) => void,
  abortSignal?: AbortSignal,
): Promise<{
  curve: CurvePoint[];
  suggestions: Suggestion[];
  measurementMeta: MeasurementMeta;
}> {
  onStatus(`Mock sweep ${options.runIndex} — preparing…`, 8);
  await runMockPhase(250, 'quiet', onAudioFrame, abortSignal);
  onStatus(`Mock sweep ${options.runIndex} — playing (simulated)…`, 28);
  await runMockPhase(Math.max(900, options.durationSeconds * 120), 'sweep', onAudioFrame, abortSignal);
  onStatus(`Mock sweep ${options.runIndex} — analyzing…`, 72);
  await runMockPhase(400, 'decay', onAudioFrame, abortSignal);
  onAudioFrame?.({ level: 0, centroid: 0.15 });
  throwIfMeasurementAborted(abortSignal);

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

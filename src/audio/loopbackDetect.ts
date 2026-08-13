export const LOOPBACK_WARNING =
  'Input may be receiving a direct or virtual loopback signal instead of a room microphone. Check the selected capture channel and interface routing.';

export interface LoopbackDetectionInput {
  recorded: Float32Array;
  sweep: Float32Array;
  sampleRate: number;
  sweepOffset: number;
  peakDb: number;
  noiseDb: number;
}

export interface LoopbackDetectionResult {
  suspected: boolean;
  reasons: string[];
  peakCorrelation: number;
  lagSeconds: number;
  snrDb: number;
}

function energy(samples: ArrayLike<number>, start: number, length: number): number {
  let sum = 0;
  const end = Math.min(samples.length, start + length);
  for (let i = start; i < end; i++) sum += samples[i] * samples[i];
  return sum;
}

function maxNormalizedCorrelation(
  recorded: Float32Array,
  sweep: Float32Array,
  sampleRate: number,
  sweepOffset: number,
): { coefficient: number; lagSeconds: number } {
  const windowSamples = Math.min(
    sweep.length,
    Math.round(sampleRate * 0.04),
    Math.max(0, recorded.length - sweepOffset),
  );

  if (windowSamples < 256 || sweepOffset < 0) {
    return { coefficient: 0, lagSeconds: Number.POSITIVE_INFINITY };
  }

  const refEnergy = energy(sweep, 0, windowSamples);
  if (refEnergy < 1e-12) {
    return { coefficient: 0, lagSeconds: Number.POSITIVE_INFINITY };
  }

  const maxLag = Math.min(
    Math.round(sampleRate * 0.02),
    recorded.length - sweepOffset - windowSamples,
  );
  if (maxLag < 0) {
    return { coefficient: 0, lagSeconds: Number.POSITIVE_INFINITY };
  }

  let best = 0;
  let bestLag = 0;
  const refScale = Math.sqrt(refEnergy);

  for (let lag = 0; lag <= maxLag; lag++) {
    const start = sweepOffset + lag;
    let dot = 0;
    let recEnergy = 0;
    for (let i = 0; i < windowSamples; i++) {
      const sample = recorded[start + i];
      dot += sample * sweep[i];
      recEnergy += sample * sample;
    }
    if (recEnergy < 1e-12) continue;
    const coefficient = dot / (refScale * Math.sqrt(recEnergy));
    if (coefficient > best) {
      best = coefficient;
      bestLag = lag;
    }
  }

  return {
    coefficient: best,
    lagSeconds: bestLag / sampleRate,
  };
}

export function detectPossibleLoopback(
  input: LoopbackDetectionInput,
): LoopbackDetectionResult {
  const reasons: string[] = [];
  const snrDb = input.peakDb - input.noiseDb;
  const correlation = maxNormalizedCorrelation(
    input.recorded,
    input.sweep,
    input.sampleRate,
    input.sweepOffset,
  );

  if (
    Number.isFinite(snrDb) &&
    input.noiseDb < -72 &&
    input.peakDb > -28 &&
    snrDb > 48
  ) {
    reasons.push('digital-noise-floor');
  }

  if (correlation.coefficient >= 0.88 && correlation.lagSeconds <= 0.008) {
    reasons.push('direct-correlation');
  }

  return {
    suspected: reasons.length >= 2,
    reasons,
    peakCorrelation: correlation.coefficient,
    lagSeconds: correlation.lagSeconds,
    snrDb,
  };
}

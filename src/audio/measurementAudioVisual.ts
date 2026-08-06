export interface MeasurementAudioFrame {
  /** Normalized output amplitude 0–1. */
  level: number;
  /** Normalized spectral centroid 0–1 (low → high frequencies). */
  centroid: number;
}

export function readMeasurementAudioFrame(analyser: AnalyserNode): MeasurementAudioFrame {
  const timeData = new Float32Array(analyser.fftSize);
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  analyser.getFloatTimeDomainData(timeData);
  analyser.getByteFrequencyData(freqData);

  let peak = 0;
  let sumSquares = 0;
  for (let i = 0; i < timeData.length; i++) {
    const sample = timeData[i];
    peak = Math.max(peak, Math.abs(sample));
    sumSquares += sample * sample;
  }
  const rms = Math.sqrt(sumSquares / timeData.length);
  const level = Math.min(1, Math.max(0, rms * 5.5 + peak * 0.35));

  let weighted = 0;
  let total = 0;
  for (let i = 0; i < freqData.length; i++) {
    const magnitude = freqData[i];
    weighted += i * magnitude;
    total += magnitude;
  }
  const centroid = total > 0 ? weighted / total / freqData.length : 0;

  return { level, centroid };
}

export function createMockMeasurementAudioFrame(
  phase: 'quiet' | 'sweep' | 'decay',
  t: number,
): MeasurementAudioFrame {
  const clamped = Math.min(1, Math.max(0, t));

  if (phase === 'quiet') {
    const flutter = 0.5 + 0.5 * Math.sin(clamped * 18);
    return { level: 0.03 + flutter * 0.025, centroid: 0.08 + flutter * 0.04 };
  }

  if (phase === 'sweep') {
    const centroid = Math.pow(clamped, 1.55);
    const wave =
      0.55 * Math.abs(Math.sin(clamped * 34 * Math.PI + centroid * 8)) +
      0.25 * Math.abs(Math.sin(clamped * 11 * Math.PI));
    return {
      level: Math.min(1, 0.18 + wave * 0.55 + centroid * 0.22),
      centroid,
    };
  }

  return {
    level: Math.max(0, 0.28 * (1 - clamped)),
    centroid: 0.55 + clamped * 0.25,
  };
}

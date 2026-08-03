import type { AnalysisResult, CurvePoint, Suggestion } from '../types';

interface WorkerInput {
  recordedBuffer: ArrayBuffer;
  sweepBuffer: ArrayBuffer;
  sampleRate: number;
  sweepOffset: number;
  fMin: number;
  fMax: number;
  smoothing: number;
  calibration: [number, number][];
}

type WorkerMessage =
  | { type: 'progress'; value: number; label: string }
  | { type: 'done'; result: AnalysisResult }
  | { type: 'error'; message: string };

function nextPowerOfTwo(value: number): number {
  let result = 1;
  while (result < value) result *= 2;
  return result;
}

function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;

  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;

    if (i < j) {
      let temp = real[i];
      real[i] = real[j];
      real[j] = temp;
      temp = imag[i];
      imag[i] = imag[j];
      imag[j] = temp;
    }
  }

  for (let length = 2; length <= n; length <<= 1) {
    const angle = (-2 * Math.PI) / length;
    const wLengthReal = Math.cos(angle);
    const wLengthImag = Math.sin(angle);

    for (let i = 0; i < n; i += length) {
      let wReal = 1;
      let wImag = 0;
      const half = length >> 1;

      for (let j = 0; j < half; j++) {
        const even = i + j;
        const odd = even + half;

        const oddReal = real[odd] * wReal - imag[odd] * wImag;
        const oddImag = real[odd] * wImag + imag[odd] * wReal;

        real[odd] = real[even] - oddReal;
        imag[odd] = imag[even] - oddImag;
        real[even] += oddReal;
        imag[even] += oddImag;

        const nextWReal = wReal * wLengthReal - wImag * wLengthImag;
        wImag = wReal * wLengthImag + wImag * wLengthReal;
        wReal = nextWReal;
      }
    }
  }
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function interpolateCalibration(
  points: [number, number][],
  frequency: number,
): number {
  if (!points.length) return 0;
  if (frequency <= points[0][0]) return points[0][1];
  if (frequency >= points[points.length - 1][0]) return points[points.length - 1][1];

  let low = 0;
  let high = points.length - 1;

  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (points[middle][0] <= frequency) low = middle;
    else high = middle;
  }

  const f1 = Math.log(points[low][0]);
  const f2 = Math.log(points[high][0]);
  const position = (Math.log(frequency) - f1) / (f2 - f1);
  return points[low][1] + position * (points[high][1] - points[low][1]);
}

function estimateQ(curve: CurvePoint[], index: number, deviation: number): number {
  const half = deviation / 2;
  let left = index;
  let right = index;

  if (deviation > 0) {
    while (left > 0 && curve[left].db > half) left--;
    while (right < curve.length - 1 && curve[right].db > half) right++;
  } else {
    while (left > 0 && curve[left].db < half) left--;
    while (right < curve.length - 1 && curve[right].db < half) right++;
  }

  const width = curve[right].frequency - curve[left].frequency;
  if (width <= 0) return 1;
  return Math.max(0.3, Math.min(12, curve[index].frequency / width));
}

function createSuggestions(curve: CurvePoint[]): Suggestion[] {
  const candidates: Array<{
    index: number;
    frequency: number;
    deviation: number;
    kind: 'cut' | 'boost' | 'null';
    score: number;
    q: number;
  }> = [];
  const radius = 5;

  for (let i = radius; i < curve.length - radius; i++) {
    const point = curve[i];
    if (point.frequency < 25 || point.frequency > 18000) continue;

    let localMax = true;
    let localMin = true;

    for (let j = i - radius; j <= i + radius; j++) {
      if (j === i) continue;
      if (curve[j].db > point.db) localMax = false;
      if (curve[j].db < point.db) localMin = false;
    }

    if (localMax && point.db >= 3) {
      candidates.push({
        index: i,
        frequency: point.frequency,
        deviation: point.db,
        kind: 'cut',
        score: point.db,
        q: estimateQ(curve, i, point.db),
      });
    }

    if (localMin && point.db <= -4) {
      candidates.push({
        index: i,
        frequency: point.frequency,
        deviation: point.db,
        kind: point.db <= -8 ? 'null' : 'boost',
        score: Math.abs(point.db) * (point.db <= -8 ? 0.8 : 0.7),
        q: estimateQ(curve, i, point.db),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const selected: typeof candidates = [];

  for (const candidate of candidates) {
    const tooClose = selected.some((item) => {
      const ratio =
        Math.max(item.frequency, candidate.frequency) /
        Math.min(item.frequency, candidate.frequency);
      return ratio < 1.22;
    });

    if (!tooClose) selected.push(candidate);
    if (selected.length >= 8) break;
  }

  return selected
    .sort((a, b) => a.frequency - b.frequency)
    .map((item) => {
      if (item.kind === 'cut') {
        const gain = -Math.min(10, Math.max(1, item.deviation - 1));
        return {
          kind: 'cut' as const,
          frequency: item.frequency,
          deviation: item.deviation,
          gain,
          q: item.q,
          note: 'Try a cut first. Set filter width based on the chart and run a verification measurement.',
        };
      }

      if (item.kind === 'null') {
        return {
          kind: 'null' as const,
          frequency: item.frequency,
          deviation: item.deviation,
          gain: null,
          q: item.q,
          note: 'Likely room cancellation. Do not boost heavily; check speaker, subwoofer, or microphone placement.',
        };
      }

      const gain = Math.min(3, Math.max(1, Math.abs(item.deviation) - 2));
      return {
        kind: 'boost' as const,
        frequency: item.frequency,
        deviation: item.deviation,
        gain,
        q: item.q,
        note: 'Boost only with caution. If the effect is small, leave the filter disabled.',
      };
    });
}

function analyze(
  recorded: Float32Array,
  sweep: Float32Array,
  sampleRate: number,
  sweepOffset: number,
  fMin: number,
  fMax: number,
  smoothing: number,
  calibration: [number, number][],
): AnalysisResult {
  if (recorded.length < 1024) throw new Error('Recording is too short.');
  if (sweepOffset < 0 || sweepOffset >= recorded.length) {
    throw new Error('Could not locate the sweep in the recording.');
  }

  const n = nextPowerOfTwo(recorded.length);
  if (n > 4194304) {
    throw new Error('Measurement is too long for this app version.');
  }

  const recordedReal = new Float32Array(n);
  const recordedImag = new Float32Array(n);
  const sweepReal = new Float32Array(n);
  const sweepImag = new Float32Array(n);

  let mean = 0;
  for (let i = 0; i < recorded.length; i++) mean += recorded[i];
  mean /= recorded.length;

  for (let i = 0; i < recorded.length; i++) {
    recordedReal[i] = recorded[i] - mean;
  }

  const available = Math.min(sweep.length, n - sweepOffset);
  if (available <= 0) throw new Error('Sweep does not fit in the recording buffer.');
  sweepReal.set(sweep.subarray(0, available), sweepOffset);

  self.postMessage({ type: 'progress', value: 76, label: 'Reference signal FFT…' });
  fft(sweepReal, sweepImag);

  self.postMessage({ type: 'progress', value: 84, label: 'Recording FFT…' });
  fft(recordedReal, recordedImag);

  const maxBin = n >> 1;
  let maxReferencePower = 0;

  for (let bin = 1; bin <= maxBin; bin++) {
    const power =
      sweepReal[bin] * sweepReal[bin] + sweepImag[bin] * sweepImag[bin];
    if (power > maxReferencePower) maxReferencePower = power;
  }

  const epsilon = Math.max(maxReferencePower * 1e-12, 1e-20);
  const prefix = new Float64Array(maxBin + 2);

  self.postMessage({
    type: 'progress',
    value: 91,
    label: 'Computing frequency response…',
  });

  for (let bin = 1; bin <= maxBin; bin++) {
    const referencePower =
      sweepReal[bin] * sweepReal[bin] + sweepImag[bin] * sweepImag[bin];

    const recordedPower =
      recordedReal[bin] * recordedReal[bin] +
      recordedImag[bin] * recordedImag[bin];

    const denominator = referencePower + epsilon;
    let transferPower =
      (recordedPower * referencePower) / (denominator * denominator);

    if (!Number.isFinite(transferPower) || transferPower < 1e-30) {
      transferPower = 1e-30;
    } else if (transferPower > 1e12) {
      transferPower = 1e12;
    }

    prefix[bin + 1] = prefix[bin] + transferPower;
  }

  const usableMax = Math.min(fMax, sampleRate * 0.475);
  const pointCount = 520;
  const curve: CurvePoint[] = [];
  const octaveHalfWidth = 1 / (2 * smoothing);

  for (let i = 0; i < pointCount; i++) {
    const ratio = i / (pointCount - 1);
    const frequency = fMin * Math.pow(usableMax / fMin, ratio);
    const lowFrequency = frequency / Math.pow(2, octaveHalfWidth);
    const highFrequency = frequency * Math.pow(2, octaveHalfWidth);

    const lowBin = Math.max(1, Math.floor((lowFrequency * n) / sampleRate));
    const highBin = Math.min(maxBin, Math.ceil((highFrequency * n) / sampleRate));
    const count = Math.max(1, highBin - lowBin + 1);
    const averagePower = (prefix[highBin + 1] - prefix[lowBin]) / count;
    const db =
      10 * Math.log10(Math.max(averagePower, 1e-30)) +
      interpolateCalibration(calibration, frequency);

    curve.push({ frequency, db });
  }

  const normalizationValues = curve
    .filter((point) => point.frequency >= 500 && point.frequency <= 2000)
    .map((point) => point.db);

  const normalization = median(normalizationValues);
  for (const point of curve) point.db -= normalization;

  self.postMessage({
    type: 'progress',
    value: 97,
    label: 'Finding peaks and dips…',
  });
  const suggestions = createSuggestions(curve);

  return { curve, suggestions, fftSize: n, normalization };
}

self.onmessage = (event: MessageEvent<WorkerInput>) => {
  try {
    const {
      recordedBuffer,
      sweepBuffer,
      sampleRate,
      sweepOffset,
      fMin,
      fMax,
      smoothing,
      calibration,
    } = event.data;

    const recorded = new Float32Array(recordedBuffer);
    const sweep = new Float32Array(sweepBuffer);
    const result = analyze(
      recorded,
      sweep,
      sampleRate,
      sweepOffset,
      fMin,
      fMax,
      smoothing,
      calibration || [],
    );

    self.postMessage({ type: 'done', result } satisfies WorkerMessage);
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    } satisfies WorkerMessage);
  }
};

export {};

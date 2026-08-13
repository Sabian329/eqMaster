import { describe, expect, it } from 'vitest';
import { detectPossibleLoopback, LOOPBACK_WARNING } from './loopbackDetect';
import { makeSweep } from './sweep';

const SAMPLE_RATE = 48_000;

function placeSweep(
  sweep: Float32Array,
  delaySamples: number,
  noiseAmplitude: number,
): Float32Array {
  const recorded = new Float32Array(sweep.length + delaySamples + SAMPLE_RATE);
  for (let i = 0; i < sweep.length; i++) {
    recorded[delaySamples + i] = sweep[i];
  }
  if (noiseAmplitude > 0) {
    for (let i = 0; i < recorded.length; i++) {
      recorded[i] += (Math.random() * 2 - 1) * noiseAmplitude;
    }
  }
  return recorded;
}

describe('detectPossibleLoopback', () => {
  const sweep = makeSweep(SAMPLE_RATE, 40, 8000, 0.4, -18);

  it('flags a dry near-zero-delay copy as possible loopback', () => {
    const delaySamples = Math.round(SAMPLE_RATE * 0.002);
    const recorded = placeSweep(sweep, delaySamples, 1e-6);
    const result = detectPossibleLoopback({
      recorded,
      sweep,
      sampleRate: SAMPLE_RATE,
      sweepOffset: 0,
      peakDb: -18,
      noiseDb: -90,
    });

    expect(result.suspected).toBe(true);
    expect(result.reasons).toContain('direct-correlation');
    expect(result.reasons).toContain('digital-noise-floor');
    expect(LOOPBACK_WARNING).toMatch(/loopback/);
  });

  it('does not flag a delayed noisy room-like capture from a single heuristic', () => {
    const delaySamples = Math.round(SAMPLE_RATE * 0.012);
    const recorded = placeSweep(sweep, delaySamples, 0.02);
    const result = detectPossibleLoopback({
      recorded,
      sweep,
      sampleRate: SAMPLE_RATE,
      sweepOffset: 0,
      peakDb: -16,
      noiseDb: -42,
    });

    expect(result.suspected).toBe(false);
    expect(result.lagSeconds).toBeGreaterThan(0.008);
  });

  it('requires two independent heuristics before warning', () => {
    const delaySamples = Math.round(SAMPLE_RATE * 0.002);
    const recorded = placeSweep(sweep, delaySamples, 1e-6);
    const highFloor = detectPossibleLoopback({
      recorded,
      sweep,
      sampleRate: SAMPLE_RATE,
      sweepOffset: 0,
      peakDb: -18,
      noiseDb: -40,
    });

    expect(highFloor.reasons).toContain('direct-correlation');
    expect(highFloor.suspected).toBe(false);
  });
});

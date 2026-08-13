import { describe, expect, it } from 'vitest';
import {
  clampInputChannelIndex,
  createRawAudioConstraints,
  formatInputChannelOption,
  isUadApolloLabel,
  uadInputRoutingHint,
} from './inputCapture';

describe('UAD Apollo input routing helpers', () => {
  it('detects Universal Audio / Apollo device labels', () => {
    expect(isUadApolloLabel('Universal Audio Thunderbolt (PCI)')).toBe(true);
    expect(isUadApolloLabel('UAD Apollo Twin')).toBe(true);
    expect(isUadApolloLabel('MacBook Pro Microphone (Built-in)')).toBe(false);
    expect(isUadApolloLabel('BlackHole 2ch (Virtual)')).toBe(false);
  });

  it('does not invent Console Mic/Virtual names for stream channels', () => {
    expect(formatInputChannelOption(0)).toBe('Capture channel 1');
    expect(formatInputChannelOption(4)).toBe('Capture channel 5');
  });

  it('returns a routing hint only for Apollo devices', () => {
    expect(uadInputRoutingHint('Universal Audio Thunderbolt (PCI)')).toMatch(
      /CoreAudio/,
    );
    expect(uadInputRoutingHint('MacBook Pro Microphone')).toBeNull();
  });

  it('clamps the selected capture channel to the opened stream range', () => {
    expect(clampInputChannelIndex(-1, 8)).toBe(0);
    expect(clampInputChannelIndex(2, 8)).toBe(2);
    expect(clampInputChannelIndex(99, 2)).toBe(1);
    expect(clampInputChannelIndex(0, 1)).toBe(0);
  });

  it('does not request a 1-channel downmix in getUserMedia constraints', () => {
    const constraints = createRawAudioConstraints('device-1');
    const audio = constraints.audio as MediaTrackConstraints;
    expect(audio.echoCancellation).toBe(false);
    expect(audio.noiseSuppression).toBe(false);
    expect(audio.autoGainControl).toBe(false);
    expect(audio.channelCount).toBeUndefined();
    expect(audio.deviceId).toEqual({ exact: 'device-1' });
  });

  it('requests many discrete channels when asking Chrome not to downmix', () => {
    const constraints = createRawAudioConstraints('device-1', {
      channelCountIdeal: 32,
    });
    const audio = constraints.audio as MediaTrackConstraints;
    expect(audio.channelCount).toEqual({ ideal: 32 });
  });
});

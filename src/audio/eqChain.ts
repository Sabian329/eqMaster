import type { ChannelMode, EqFilterType, Suggestion } from '../types';
import { clampSuggestionQ } from '../utils/suggestionQ';

function getWebAudioFilterType(filterType: EqFilterType | undefined): BiquadFilterType {
  switch (filterType) {
    case 'LS':
      return 'lowshelf';
    case 'HS':
      return 'highshelf';
    case 'PK':
    default:
      return 'peaking';
  }
}

export interface EqApplyProfile {
  suggestions: Suggestion[];
  preampDb: number;
}

export function getActiveEqFilters(suggestions: Suggestion[]): Suggestion[] {
  return suggestions.filter((item) => {
    if (item.enabled === false) return false;
    if (item.kind === 'null') return false;
    return item.gain !== null && item.gain !== 0;
  });
}

export function hasEqToApply(profile: EqApplyProfile): boolean {
  const safePreamp = Number.isFinite(profile.preampDb) ? profile.preampDb : 0;
  return getActiveEqFilters(profile.suggestions).length > 0 || Math.abs(safePreamp) > 0.01;
}

/**
 * Connects source → preamp → peaking filters → destination.
 * Returns the last node in the chain (for optional further routing).
 */
export function connectEqChain(
  context: BaseAudioContext,
  source: AudioNode,
  destination: AudioNode,
  profile: EqApplyProfile,
): AudioNode {
  const safePreamp = Number.isFinite(profile.preampDb)
    ? Math.max(-30, Math.min(12, profile.preampDb))
    : 0;

  let tail: AudioNode = source;

  const preamp = context.createGain();
  preamp.gain.value = Math.pow(10, safePreamp / 20);
  tail.connect(preamp);
  tail = preamp;

  for (const filter of getActiveEqFilters(profile.suggestions)) {
    const biquad = context.createBiquadFilter();
    biquad.type = getWebAudioFilterType(filter.filterType);
    biquad.frequency.value = Math.max(1, filter.frequency);
    biquad.Q.value = clampSuggestionQ(filter.q);
    biquad.gain.value = filter.gain ?? 0;
    tail.connect(biquad);
    tail = biquad;
  }

  tail.connect(destination);
  return tail;
}

/** Renders sweep through the same EQ chain for analysis reference. */
export async function renderSweepWithEq(
  sampleRate: number,
  sweepData: Float32Array,
  channel: ChannelMode,
  profile: EqApplyProfile,
): Promise<Float32Array> {
  const offline = new OfflineAudioContext(2, sweepData.length, sampleRate);
  const buffer = offline.createBuffer(2, sweepData.length, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  if (channel === 'left' || channel === 'both') left.set(sweepData);
  if (channel === 'right' || channel === 'both') right.set(sweepData);

  const source = offline.createBufferSource();
  source.buffer = buffer;
  connectEqChain(offline, source, offline.destination, profile);
  source.start(0);
  const rendered = await offline.startRendering();
  const outLeft = rendered.getChannelData(0);
  const outRight = rendered.getChannelData(1);
  const mono = new Float32Array(outLeft.length);
  for (let i = 0; i < outLeft.length; i++) {
    mono[i] = (outLeft[i] + outRight[i]) * 0.5;
  }
  return mono;
}

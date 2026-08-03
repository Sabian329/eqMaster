export type ToneProfileId =
  | 'flat'
  | 'warm'
  | 'rock'
  | 'drum-bass'
  | 'pop'
  | 'electronic'
  | 'vocal'
  | 'jazz';

export type EqBandCount = 4 | 6 | 8 | 10 | 12 | 16;

export interface ToneProfileAnchor {
  frequency: number;
  db: number;
}

export interface ToneProfile {
  id: ToneProfileId;
  label: string;
  description: string;
  anchors: ToneProfileAnchor[];
}

export const EQ_BAND_OPTIONS: Array<{ value: EqBandCount; label: string }> = [
  { value: 4, label: '4 bands' },
  { value: 6, label: '6 bands' },
  { value: 8, label: '8 bands' },
  { value: 10, label: '10 bands' },
  { value: 12, label: '12 bands' },
  { value: 16, label: '16 bands' },
];

export const TONE_PROFILES: ToneProfile[] = [
  {
    id: 'flat',
    label: 'Flat (reference)',
    description: 'Neutral target — correct room issues only, no tonal bias.',
    anchors: [
      { frequency: 20, db: 0 },
      { frequency: 20000, db: 0 },
    ],
  },
  {
    id: 'warm',
    label: 'Warm',
    description: 'Gentle bass lift with softened treble for a richer, relaxed tone.',
    anchors: [
      { frequency: 40, db: 2.5 },
      { frequency: 120, db: 1.8 },
      { frequency: 400, db: 0.5 },
      { frequency: 1000, db: 0 },
      { frequency: 3000, db: -1 },
      { frequency: 8000, db: -2.5 },
      { frequency: 16000, db: -3.5 },
    ],
  },
  {
    id: 'rock',
    label: 'Rock',
    description: 'Punchy low end and forward upper mids for guitars and drums.',
    anchors: [
      { frequency: 60, db: 1.5 },
      { frequency: 120, db: 0.5 },
      { frequency: 400, db: -1 },
      { frequency: 1000, db: 0 },
      { frequency: 2500, db: 2 },
      { frequency: 5000, db: 1.5 },
      { frequency: 10000, db: 0 },
      { frequency: 16000, db: -1 },
    ],
  },
  {
    id: 'drum-bass',
    label: 'Drum & bass',
    description: 'Extended sub, controlled mids, and bright detail for electronic bass music.',
    anchors: [
      { frequency: 30, db: 3 },
      { frequency: 60, db: 2 },
      { frequency: 120, db: 0.5 },
      { frequency: 400, db: -1.5 },
      { frequency: 1000, db: -2 },
      { frequency: 3000, db: -0.5 },
      { frequency: 8000, db: 1.5 },
      { frequency: 14000, db: 2 },
    ],
  },
  {
    id: 'pop',
    label: 'Pop',
    description: 'Balanced smile curve — full lows and airy highs with clear mids.',
    anchors: [
      { frequency: 50, db: 1.5 },
      { frequency: 200, db: 0.5 },
      { frequency: 800, db: -0.5 },
      { frequency: 3000, db: 0.5 },
      { frequency: 8000, db: 1.5 },
      { frequency: 14000, db: 2 },
    ],
  },
  {
    id: 'electronic',
    label: 'Electronic',
    description: 'Deep sub weight with crisp highs for synths and club systems.',
    anchors: [
      { frequency: 35, db: 3 },
      { frequency: 80, db: 1.5 },
      { frequency: 250, db: 0 },
      { frequency: 800, db: -1 },
      { frequency: 2500, db: 0 },
      { frequency: 6000, db: 1.5 },
      { frequency: 12000, db: 2.5 },
    ],
  },
  {
    id: 'vocal',
    label: 'Vocal / speech',
    description: 'Mid-forward clarity for podcasts, dialogue, and vocal-centric listening.',
    anchors: [
      { frequency: 80, db: -1 },
      { frequency: 200, db: -0.5 },
      { frequency: 500, db: 0.5 },
      { frequency: 1500, db: 1.5 },
      { frequency: 3500, db: 2.5 },
      { frequency: 6000, db: 1.5 },
      { frequency: 10000, db: 0.5 },
      { frequency: 16000, db: -1 },
    ],
  },
  {
    id: 'jazz',
    label: 'Jazz / acoustic',
    description: 'Natural timbre with light warmth and subtle air for acoustic instruments.',
    anchors: [
      { frequency: 60, db: 1 },
      { frequency: 200, db: 0.5 },
      { frequency: 800, db: 0 },
      { frequency: 2500, db: 0.5 },
      { frequency: 6000, db: 0.5 },
      { frequency: 12000, db: 1.5 },
      { frequency: 16000, db: 1 },
    ],
  },
];

export function getToneProfile(id: ToneProfileId): ToneProfile {
  return TONE_PROFILES.find((profile) => profile.id === id) ?? TONE_PROFILES[0];
}

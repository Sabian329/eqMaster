export type EqStrategyId = 'balanced' | 'fit' | 'resonance';

export interface EqStrategy {
  id: EqStrategyId;
  label: string;
  description: string;
}

export const EQ_STRATEGIES: EqStrategy[] = [
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Correct peaks and dips evenly toward the tone target.',
  },
  {
    id: 'fit',
    label: 'Fit (gentle)',
    description:
      'Partial correction like WiiM Fit — tames resonances, keeps more bass headroom, favours dip fills below 400 Hz.',
  },
  {
    id: 'resonance',
    label: 'Resonance only',
    description:
      'Aggressive narrow peak cuts; minimal broad bass shelving. Boost dips manually or with custom bands.',
  },
];

export function getEqStrategy(id: EqStrategyId): EqStrategy {
  return EQ_STRATEGIES.find((item) => item.id === id) ?? EQ_STRATEGIES[0];
}

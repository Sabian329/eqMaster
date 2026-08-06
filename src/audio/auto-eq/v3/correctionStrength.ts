export function getCorrectionStrength(
	frequency: number,
	measurementCount: number,
	confidence: number,
): number {
	let strength: number;

	if (frequency < 200) {
		strength = 0.95;
	} else if (frequency < 1_000) {
		strength = 0.8;
	} else if (frequency < 5_000) {
		strength = 0.65;
	} else if (frequency < 10_000) {
		strength = 0.5;
	} else {
		strength = 0.4;
	}

	if (measurementCount === 1 && frequency >= 1_000) {
		strength *= 0.8;
	}

	const confidenceMultiplier = Math.max(0.5, Math.min(1, confidence));
	return strength * confidenceMultiplier;
}

export function getPreferredMaximumQ(frequency: number): number {
	if (frequency < 200) return 10;
	if (frequency < 1_000) return 6;
	if (frequency < 5_000) return 2.5;
	if (frequency < 10_000) return 1.8;
	return 1.2;
}

export function getHighQPenaltyWeight(
	frequency: number,
	measurementCount: number,
): number {
	let weight: number;

	if (frequency < 200) {
		weight = 0.01;
	} else if (frequency < 1_000) {
		weight = 0.03;
	} else if (frequency < 5_000) {
		weight = 0.12;
	} else if (frequency < 10_000) {
		weight = 0.2;
	} else {
		weight = 0.3;
	}

	if (measurementCount === 1 && frequency >= 2_000) {
		weight *= 1.75;
	}

	return weight;
}

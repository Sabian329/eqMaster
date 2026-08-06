import { clamp } from "./math";

export function getV4CorrectionStrength(
	frequency: number,
	measurementCount: number,
	confidence: number,
	scalePersistence = 1,
): number {
	let strength: number;

	if (frequency < 200) {
		strength = 1.0;
	} else if (frequency < 1_000) {
		strength = 0.9;
	} else if (frequency < 5_000) {
		strength = 0.65;
	} else if (frequency < 10_000) {
		strength = 0.5;
	} else {
		strength = 0.35;
	}

	if (measurementCount === 1 && frequency >= 1_000) {
		strength *= 0.8;
	}

	return (
		strength *
		clamp(confidence, 0.4, 1) *
		clamp(scalePersistence, 0.5, 1)
	);
}

export function getPreferredMaximumQ(frequency: number): number {
	if (frequency < 200) return 12;
	if (frequency < 1_000) return 7;
	if (frequency < 5_000) return 3;
	if (frequency < 10_000) return 2;
	return 1.4;
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

export function getMinimumScalePersistence(frequency: number): number {
	if (frequency < 200) return 0.4;
	if (frequency < 1_000) return 0.5;
	if (frequency < 5_000) return 0.65;
	if (frequency < 10_000) return 0.75;
	return 0.8;
}

export function getV4MinimumImprovementPercent(filterCount: number): number {
	if (filterCount < 4) return 0.03;
	if (filterCount < 8) return 0.06;
	if (filterCount < 12) return 0.12;
	return 0.2;
}

export function getV4TargetToleranceDb(frequency: number): number {
	if (frequency < 200) return 0.75;
	if (frequency < 1_000) return 1.0;
	if (frequency < 5_000) return 1.5;
	if (frequency < 10_000) return 1.75;
	return 2.25;
}

export function getTargetToleranceDb(frequency: number): number {
	if (frequency < 200) return 1.0;
	if (frequency < 1_000) return 1.25;
	if (frequency < 5_000) return 1.75;
	if (frequency < 10_000) return 2.0;
	return 2.5;
}

export function applyTolerance(errorDb: number, toleranceDb: number): number {
	const magnitude = Math.abs(errorDb);
	if (magnitude <= toleranceDb) return 0;
	return Math.sign(errorDb) * (magnitude - toleranceDb);
}

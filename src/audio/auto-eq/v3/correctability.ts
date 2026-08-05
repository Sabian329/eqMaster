export interface AnalysisPoint {
	frequency: number;
	reliability: number;
	isDeepNull: boolean;
	requiresBoost: boolean;
	boostAllowed: boolean;
	requiresCut: boolean;
	isOutsideUsableRange: boolean;
}

export function getCorrectabilityWeight(point: AnalysisPoint): number {
	if (point.isDeepNull) return 0.05;

	if (point.requiresBoost && !point.boostAllowed) return 0.05;

	if (point.isOutsideUsableRange) {
		return point.requiresCut ? 0.4 : 0.05;
	}

	if (point.reliability < 0.25) return 0.15;

	return 1;
}

export function buildAnalysisPoint(input: {
	frequency: number;
	errorDb: number;
	reliability: number;
	boostAllowed: boolean;
	usableFromHz: number;
	usableToHz: number;
	deepNullThresholdDb?: number;
}): AnalysisPoint {
	const deepNullThresholdDb = input.deepNullThresholdDb ?? 7;
	const requiresBoost = input.errorDb < 0;
	const requiresCut = input.errorDb > 0;
	const isDeepNull = input.errorDb <= -deepNullThresholdDb;
	const isOutsideUsableRange =
		input.frequency < input.usableFromHz ||
		input.frequency > input.usableToHz;

	return {
		frequency: input.frequency,
		reliability: input.reliability,
		isDeepNull,
		requiresBoost,
		boostAllowed: input.boostAllowed,
		requiresCut,
		isOutsideUsableRange,
	};
}

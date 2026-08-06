import { NULL_DEPTH_DB } from "./constants";
import type { V4AnalysisPoint } from "./types";

export function getCorrectabilityWeight(point: V4AnalysisPoint): number {
	if (point.isDeepNull) return 0.05;
	if (point.isCombArtifact) return 0.1;
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
	isCombArtifact?: boolean;
	deepNullThresholdDb?: number;
}): V4AnalysisPoint {
	const deepNullThresholdDb = input.deepNullThresholdDb ?? NULL_DEPTH_DB;
	const requiresBoost = input.errorDb < 0;
	const requiresCut = input.errorDb > 0;
	const isDeepNull = input.errorDb <= -deepNullThresholdDb;
	const isOutsideUsableRange =
		input.frequency < input.usableFromHz || input.frequency > input.usableToHz;

	return {
		frequency: input.frequency,
		reliability: input.reliability,
		isDeepNull,
		isCombArtifact: Boolean(input.isCombArtifact),
		requiresBoost,
		boostAllowed: input.boostAllowed,
		requiresCut,
		isOutsideUsableRange,
	};
}

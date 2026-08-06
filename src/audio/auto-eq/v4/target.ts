import { ROOM_TARGET } from "./constants";
import { interpolateLogarithmically, median } from "./math";
import type {
	AutoEqV4Options,
	FrequencyPoint,
	ResolvedV4Target,
	TargetType,
} from "./types";

export function getTargetLabel(type: TargetType): string {
	if (type === "flat") return "Flat target";
	if (type === "room") return "Room target";
	return "Custom target";
}

export const buildTargetPoints = (
	options: AutoEqV4Options,
): FrequencyPoint[] => {
	if (
		options.targetType === "custom" &&
		options.customTarget &&
		options.customTarget.length >= 2
	) {
		return [...options.customTarget].sort((a, b) => a.frequency - b.frequency);
	}
	if (options.targetType === "flat") {
		return [
			{ frequency: options.minFrequency, db: 0 },
			{ frequency: options.maxFrequency, db: 0 },
		];
	}
	return ROOM_TARGET;
};

export const buildTargetCurve = (
	grid: FrequencyPoint[],
	options: AutoEqV4Options,
): FrequencyPoint[] => {
	const targetPoints = buildTargetPoints(options);
	return grid.map((point) => ({
		frequency: point.frequency,
		db: interpolateLogarithmically(targetPoints, point.frequency),
	}));
};

export const alignTargetToMeasurement = (
	measured: FrequencyPoint[],
	target: FrequencyPoint[],
): { aligned: FrequencyPoint[]; levelOffsetDb: number } => {
	const referenceErrors = measured
		.map((point, index) => ({
			frequency: point.frequency,
			difference: point.db - target[index].db,
		}))
		.filter((point) => point.frequency >= 200 && point.frequency <= 1_000)
		.map((point) => point.difference);

	const fallbackErrors = measured.map(
		(point, index) => point.db - target[index].db,
	);
	const levelOffsetDb = median(
		referenceErrors.length > 0 ? referenceErrors : fallbackErrors,
	);

	return {
		levelOffsetDb,
		aligned: target.map((point) => ({
			frequency: point.frequency,
			db: point.db + levelOffsetDb,
		})),
	};
};

/**
 * Resolves the target curve on the shared analysis grid, aligning its level
 * to the measurement's median 200-1000 Hz band. Because every fractional
 * scale (native/fine/mid/broad) shares the same grid, this single aligned
 * curve doubles as the "multi-scale target" referenced against each scale.
 */
export function resolveV4Target(
	alignmentReferenceCurve: FrequencyPoint[],
	grid: FrequencyPoint[],
	options: AutoEqV4Options,
): ResolvedV4Target {
	const rawTarget = buildTargetCurve(grid, options);
	const { aligned, levelOffsetDb } = alignTargetToMeasurement(
		alignmentReferenceCurve,
		rawTarget,
	);

	return {
		type: options.targetType,
		points: aligned,
		points1_24: aligned,
		points1_12: aligned,
		points1_6: aligned,
		points1_3: aligned,
		levelOffsetDb,
		label: getTargetLabel(options.targetType),
	};
}

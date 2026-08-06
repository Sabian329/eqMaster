import {
	BELOW_TARGET_BOOST_LIMIT_DB,
	DENSE_GRID,
	GRID_SIZE,
	SIM_GRID_SIZE,
	USABLE_RANGE_DROP_DB,
} from "./constants";
import { buildAnalysisPoint } from "./correctability";
import {
	deriveMultiScaleFromGridCurve,
	deriveMultiScaleFromRaw,
} from "./fractionalOctave";
import { clamp, createLogarithmicGrid, median, medianAbsoluteDeviation } from "./math";
import { getCombinedFilterResponseDb } from "./biquadResponse";
import { detectCombArtifactFrequencies, detectDeepNulls } from "./nullDetection";
import { resolveV4Target } from "./target";
import { validateV4MeasurementResolution } from "./validation";
import type {
	AutoEqV4Options,
	AutoEqV4Warning,
	EqFilterType,
	FrequencyPoint,
	MultiScaleCurves,
	PreparedV4Measurement,
	V4AnalysisPoint,
	V4FilterReason,
	V4GeneratedFilter,
} from "./types";

function computeReliability(repeatabilityDb: number): number {
	return Math.exp(-((repeatabilityDb / 1.5) ** 2));
}

export function singleMeasurementReliability(
	frequency: number,
	measurementCount: number,
): number {
	if (measurementCount > 1) return 1;
	if (frequency < 500) return 1;
	if (frequency < 2_000) return 0.85;
	if (frequency < 5_000) return 0.65;
	return 0.45;
}

function detectUsableBoostRange(
	broad: FrequencyPoint[],
	referenceDb: number,
): { fromHz: number; toHz: number } {
	let fromHz = broad[0]?.frequency ?? 20;
	let toHz = broad[broad.length - 1]?.frequency ?? 20_000;

	for (const point of broad) {
		if (point.db >= referenceDb - USABLE_RANGE_DROP_DB) {
			fromHz = point.frequency;
			break;
		}
	}

	for (let index = broad.length - 1; index >= 0; index -= 1) {
		const point = broad[index];
		if (point.db >= referenceDb - USABLE_RANGE_DROP_DB) {
			toHz = point.frequency;
			break;
		}
	}

	return { fromHz, toHz };
}

function combineByMedian(
	grid: FrequencyPoint[],
	perMeasurement: MultiScaleCurves[],
	scaleKey: keyof MultiScaleCurves,
): FrequencyPoint[] {
	return grid.map((point, index) => ({
		frequency: point.frequency,
		db: median(perMeasurement.map((scales) => scales[scaleKey][index].db)),
	}));
}

export function prepareMeasurement(
	measurements: FrequencyPoint[][],
	options: AutoEqV4Options,
): PreparedV4Measurement {
	const resolution = validateV4MeasurementResolution(measurements);

	const nyquist = options.sampleRate * 0.49;
	const maxFrequency = Math.min(options.maxFrequency, nyquist);
	const grid = createLogarithmicGrid(options.minFrequency, maxFrequency, GRID_SIZE);
	const simGrid = createLogarithmicGrid(options.minFrequency, maxFrequency, SIM_GRID_SIZE);
	const denseGrid = createLogarithmicGrid(options.minFrequency, maxFrequency, DENSE_GRID);

	const perMeasurementScales = measurements.map((raw) =>
		deriveMultiScaleFromRaw(raw, grid),
	);
	const measurementCount = perMeasurementScales.length;

	const native1_24 = combineByMedian(grid, perMeasurementScales, "native1_24");
	const octave1_12 = combineByMedian(grid, perMeasurementScales, "octave1_12");
	const octave1_6 = combineByMedian(grid, perMeasurementScales, "octave1_6");
	const octave1_3 = combineByMedian(grid, perMeasurementScales, "octave1_3");

	const warnings: AutoEqV4Warning[] = [];

	const repeatabilityDb = new Float64Array(grid.length);
	const reliability = new Float64Array(grid.length);
	for (let index = 0; index < grid.length; index += 1) {
		const values = perMeasurementScales.map(
			(scales) => scales.octave1_12[index].db,
		);
		repeatabilityDb[index] = medianAbsoluteDeviation(values);
		const baseReliability = computeReliability(repeatabilityDb[index]);
		const singleFactor = singleMeasurementReliability(
			grid[index].frequency,
			measurementCount,
		);
		reliability[index] = baseReliability * singleFactor;
	}

	if (measurementCount === 1) {
		warnings.push("single-measurement-high-frequency-correction");
	}
	const lowRepeatabilityCount = Array.from(repeatabilityDb).filter(
		(value) => value > 2.5,
	).length;
	if (lowRepeatabilityCount > grid.length * 0.15) {
		warnings.push("low-repeatability");
	}

	const resolvedTarget = resolveV4Target(octave1_6, grid, options);
	const target = resolvedTarget.points;

	const narrowResidual = grid.map((point, index) => ({
		frequency: point.frequency,
		db: native1_24[index].db - octave1_12[index].db,
	}));
	const tonalError = grid.map((point, index) => ({
		frequency: point.frequency,
		db: octave1_6[index].db - target[index].db,
	}));
	const broadExcess = grid.map((point, index) => ({
		frequency: point.frequency,
		db: octave1_3[index].db - target[index].db,
	}));

	const referenceValues = octave1_3
		.filter((point) => point.frequency >= 200 && point.frequency <= 1_000)
		.map((point) => point.db);
	const referenceDb = median(
		referenceValues.length > 0 ? referenceValues : octave1_3.map((point) => point.db),
	);
	const usableBoostRange = detectUsableBoostRange(octave1_3, referenceDb);
	if (usableBoostRange.toHz - usableBoostRange.fromHz < maxFrequency * 0.25) {
		warnings.push("correction-limited-by-speaker-range");
	}

	const deepNulls = detectDeepNulls(grid, narrowResidual);
	const combFrequencies = detectCombArtifactFrequencies(deepNulls);
	if (deepNulls.length > 0) warnings.push("deep-null-detected");
	if (combFrequencies.size > 0) warnings.push("comb-artifact-detected");

	const deepNullIndices = new Set(deepNulls.map((entry) => entry.index));

	const analysisPoints: V4AnalysisPoint[] = grid.map((point, index) => {
		const errorDb = octave1_6[index].db - target[index].db;
		const analysis = buildAnalysisPoint({
			frequency: point.frequency,
			errorDb,
			reliability: reliability[index],
			boostAllowed:
				options.allowBoosts &&
				point.frequency >= usableBoostRange.fromHz &&
				point.frequency <= usableBoostRange.toHz,
			usableFromHz: usableBoostRange.fromHz,
			usableToHz: usableBoostRange.toHz,
			isCombArtifact: combFrequencies.has(point.frequency),
		});
		if (deepNullIndices.has(index)) analysis.isDeepNull = true;
		return analysis;
	});

	return {
		native1_24,
		octave1_12,
		octave1_6,
		octave1_3,
		grid,
		simGrid,
		denseGrid,
		target,
		resolvedTarget,
		narrowResidual,
		tonalError,
		broadExcess,
		reliability,
		repeatabilityDb,
		analysisPoints,
		measurementCount,
		usableBoostRange,
		targetType: resolvedTarget.type,
		targetLevelOffsetDb: resolvedTarget.levelOffsetDb,
		targetLabel: resolvedTarget.label,
		resolution,
		warnings,
	};
}

/**
 * Recomputes multi-scale residuals after applying `filters` to the native
 * 1/24 curve, without re-deriving from RAW. Used between beam-search /
 * optimization iterations to keep candidate detection responsive.
 */
export function refreshResiduals(
	prepared: PreparedV4Measurement,
	filters: V4GeneratedFilter[],
	options: AutoEqV4Options,
): PreparedV4Measurement {
	const corrected = prepared.native1_24.map((point) => ({
		frequency: point.frequency,
		db:
			point.db +
			getCombinedFilterResponseDb(filters, point.frequency, options.sampleRate),
	}));
	const scales = deriveMultiScaleFromGridCurve(corrected);

	const narrowResidual = prepared.grid.map((point, index) => ({
		frequency: point.frequency,
		db: scales.native1_24[index].db - scales.octave1_12[index].db,
	}));
	const tonalError = prepared.grid.map((point, index) => ({
		frequency: point.frequency,
		db: scales.octave1_6[index].db - prepared.target[index].db,
	}));
	const broadExcess = prepared.grid.map((point, index) => ({
		frequency: point.frequency,
		db: scales.octave1_3[index].db - prepared.target[index].db,
	}));

	return {
		...prepared,
		...scales,
		narrowResidual,
		tonalError,
		broadExcess,
	};
}

export function isFrequencyInRange(
	frequency: number,
	range: { fromHz: number; toHz: number },
): boolean {
	return frequency >= range.fromHz && frequency <= range.toHz;
}

export function canBoostAtFrequency(
	prepared: PreparedV4Measurement,
	frequency: number,
	options: AutoEqV4Options,
): boolean {
	if (!options.allowBoosts) return false;
	if (!isFrequencyInRange(frequency, prepared.usableBoostRange)) return false;

	const index = prepared.grid.findIndex(
		(point) => Math.abs(Math.log2(point.frequency / frequency)) < 1 / 96,
	);
	if (index < 0) return true;

	const belowTarget =
		prepared.octave1_12[index].db <
			prepared.target[index].db - BELOW_TARGET_BOOST_LIMIT_DB ||
		prepared.octave1_3[index].db <
			prepared.target[index].db - BELOW_TARGET_BOOST_LIMIT_DB;

	return !belowTarget;
}

export function clampFrequencyToOptions(
	frequency: number,
	options: AutoEqV4Options,
): number {
	return clamp(frequency, options.minFrequency, options.maxFrequency);
}

/** Keeps shelf / tonal-region filters inside their intended bands during optimization. */
export function clampFilterFrequency(
	frequency: number,
	filterType: EqFilterType,
	reason: V4FilterReason,
	options: AutoEqV4Options,
): number {
	let minHz = options.minFrequency;
	let maxHz = options.maxFrequency;

	if (filterType === "HS" || reason === "high-shelf") {
		minHz = Math.max(minHz, 5_500);
		maxHz = Math.min(maxHz, 12_000);
	} else if (filterType === "LS" || reason === "low-shelf") {
		minHz = Math.max(minHz, 40);
		maxHz = Math.min(maxHz, 250);
	} else if (reason === "tonal-region" && frequency >= 1_000) {
		minHz = Math.max(minHz, 1_500);
		maxHz = Math.min(maxHz, 3_500);
	}

	return clamp(frequency, minHz, maxHz);
}

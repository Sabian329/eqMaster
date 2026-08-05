import type { CurvePoint, Suggestion } from "../types";
import type { AutoEqResult, PeakingEqFilter } from "../audio/autoEq";
import { generateAutoEqV3 } from "../audio/auto-eq/v3/autoEqV3";
import { interpolateLogarithmically } from "../audio/auto-eq/v3/math";
import type {
	AutoEqV3Result,
	GeneratedEqFilter,
} from "../audio/auto-eq/v3/types";
import type { AutoEqPipelineOptions } from "./autoEqBridge";
import { PRO_MAX_AUTO_BANDS } from "./autoEqBridge";

const REASON_LABELS: Record<GeneratedEqFilter["reason"], string> = {
	"local-resonance": "Local resonance",
	"repeated-resonance": "Repeated resonance",
	"broad-tonal-error": "Broad tonal error",
	"low-frequency-tilt": "Low-frequency tilt",
	"high-frequency-tilt": "High-frequency tilt",
};

function v3FilterToSuggestion(
	filter: GeneratedEqFilter,
	measured: CurvePoint[],
	target: CurvePoint[],
): Suggestion {
	const measuredDb = interpolateLogarithmically(measured, filter.frequency);
	const targetDb = interpolateLogarithmically(target, filter.frequency);
	const deviation = measuredDb - targetDb;

	return {
		kind: filter.gainDb < 0 ? "cut" : "boost",
		frequency: filter.frequency,
		deviation,
		gain: filter.gainDb,
		q: filter.q,
		note: `V3 Auto EQ — ${REASON_LABELS[filter.reason]} (conf ${Math.round(filter.confidence * 100)}%, +${filter.improvementPercent.toFixed(1)}%).`,
		source: "auto",
		enabled: filter.enabled,
		filterType: filter.type,
	};
}

function v3PeakingFilters(filters: GeneratedEqFilter[]): PeakingEqFilter[] {
	return filters
		.filter((filter) => filter.type === "PK")
		.map((filter) => ({
			type: "PK" as const,
			frequency: filter.frequency,
			gainDb: filter.gainDb,
			q: filter.q,
		}));
}

function mapV3ToLegacyResult(result: AutoEqV3Result): AutoEqResult {
	return {
		filters: v3PeakingFilters(result.filters),
		preampDb: result.preampDb,
		measured: result.measured,
		target: result.target,
		corrected: result.predicted,
		errorBefore: result.errorBefore,
		errorAfter: result.errorAfter,
	};
}

export interface AutoEqPipelineV3Options extends AutoEqPipelineOptions {
	measurements?: CurvePoint[][];
	targetType?: "flat" | "room" | "custom";
	allowBoosts?: boolean;
	fullRangeCorrection?: boolean;
	seed?: number;
}

export function runAutoEqPipelineV3(
	rawCurve: CurvePoint[],
	options: AutoEqPipelineV3Options = {},
): AutoEqResult & { suggestions: Suggestion[]; v3?: AutoEqV3Result } {
	const measurements =
		options.measurements && options.measurements.length > 0
			? options.measurements
			: [rawCurve];

	const result = generateAutoEqV3(measurements, {
		sampleRate: options.sampleRate ?? 48_000,
		minFrequency: Math.max(20, options.fStart ?? 20),
		maxFrequency: options.fEnd ?? 20_000,
		maxFilters: options.maxFilters ?? PRO_MAX_AUTO_BANDS,
		targetType: options.targetType ?? "room",
		allowBoosts: options.allowBoosts ?? true,
		fullRangeCorrection: options.fullRangeCorrection ?? true,
		seed: options.seed ?? 42,
	});

	const suggestions = result.filters.map((filter) =>
		v3FilterToSuggestion(filter, result.measured, result.target),
	);

	return {
		...mapV3ToLegacyResult(result),
		suggestions,
		v3: result,
	};
}

export function mapAutoEqV3ResultToPipeline(
	result: AutoEqV3Result,
): AutoEqResult & { suggestions: Suggestion[]; v3: AutoEqV3Result } {
	const suggestions = result.filters.map((filter) =>
		v3FilterToSuggestion(filter, result.measured, result.target),
	);

	return {
		...mapV3ToLegacyResult(result),
		suggestions,
		v3: result,
	};
}

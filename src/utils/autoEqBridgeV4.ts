import type { CurvePoint, Suggestion } from "../types";
import type { AutoEqResult, PeakingEqFilter } from "../audio/autoEq";
import { generateAutoEqV4 } from "../audio/auto-eq/v4/autoEqV4";
import { bandwidthOctavesFromQ, interpolateLogarithmically } from "../audio/auto-eq/v4/math";
import type {
	AutoEqV4Result,
	V4GeneratedFilter,
	V4FilterReason,
} from "../audio/auto-eq/v4/types";
import type { AutoEqPipelineOptions } from "./autoEqBridge";
import { PRO_MAX_AUTO_BANDS } from "./autoEqBridge";

const REASON_LABELS: Record<V4FilterReason, string> = {
	"modal-resonance": "Modal resonance",
	"persistent-local-resonance": "Persistent local resonance",
	"repeated-resonance": "Repeated resonance",
	"broad-tonal-excess": "Broad tonal excess",
	"low-frequency-tilt": "Low-frequency tilt",
	"high-frequency-tilt": "High-frequency tilt",
	resonance: "Resonance",
	"tonal-region": "Tonal region",
	"low-shelf": "Low shelf",
	"high-shelf": "High shelf",
};

function v4FilterToSuggestion(
	filter: V4GeneratedFilter,
	measured: CurvePoint[],
	target: CurvePoint[],
): Suggestion {
	const measuredDb = interpolateLogarithmically(measured, filter.frequency);
	const targetDb = interpolateLogarithmically(target, filter.frequency);
	const deviation = measuredDb - targetDb;
	const widthOctaves = bandwidthOctavesFromQ(filter.q);
	const localImprovement = filter.localImprovement?.toFixed(3) ?? "n/a";
	const offBandDamage = filter.offBandDamage?.toFixed(3) ?? "n/a";
	const safetyTag =
		filter.weakenedBySafetyPass || filter.safetyAdjusted ? " · Safety adjusted" : "";

	return {
		kind: filter.gainDb < 0 ? "cut" : "boost",
		frequency: filter.frequency,
		deviation,
		gain: filter.gainDb,
		q: filter.q,
		note: `V4 — ${REASON_LABELS[filter.reason]} · conf ${Math.round(filter.confidence * 100)}% · +${filter.improvementPercent.toFixed(1)}% · Q ${filter.q.toFixed(2)} (${widthOctaves.toFixed(2)} oct) · local ${localImprovement} · off-band ${offBandDamage}${safetyTag}`,
		source: "auto",
		enabled: filter.enabled,
		filterType: filter.type,
		safetyAdjusted: filter.weakenedBySafetyPass || filter.safetyAdjusted,
		localImprovement: filter.localImprovement,
		offBandDamage: filter.offBandDamage,
		confidence: filter.confidence,
		improvementPercent: filter.improvementPercent,
		reason: filter.reason,
	};
}

function v4PeakingFilters(filters: V4GeneratedFilter[]): PeakingEqFilter[] {
	return filters
		.filter((filter) => filter.type === "PK")
		.map((filter) => ({
			type: "PK" as const,
			frequency: filter.frequency,
			gainDb: filter.gainDb,
			q: filter.q,
		}));
}

function mapV4ToLegacyResult(result: AutoEqV4Result): AutoEqResult {
	return {
		filters: v4PeakingFilters(result.filters),
		preampDb: result.preampDb,
		measured: result.measured1_12,
		target: result.target,
		corrected: result.predicted1_12,
		errorBefore: result.errorBefore,
		errorAfter: result.errorAfter,
	};
}

export interface AutoEqPipelineV4Options extends AutoEqPipelineOptions {
	measurements?: CurvePoint[][];
	targetType?: "flat" | "room" | "custom";
	allowBoosts?: boolean;
	seed?: number;
	precisionMode?: "balanced" | "maximum";
}

export function runAutoEqPipelineV4(
	rawCurve: CurvePoint[],
	options: AutoEqPipelineV4Options = {},
): AutoEqResult & { suggestions: Suggestion[]; v4?: AutoEqV4Result } {
	const measurements =
		options.measurements && options.measurements.length > 0
			? options.measurements
			: [rawCurve];

	const result = generateAutoEqV4(measurements, {
		sampleRate: options.sampleRate ?? 48_000,
		minFrequency: Math.max(20, options.fStart ?? 20),
		maxFrequency: options.fEnd ?? 20_000,
		maxFilters: options.maxFilters ?? PRO_MAX_AUTO_BANDS,
		targetType: options.targetType ?? "room",
		allowBoosts: options.allowBoosts ?? true,
		seed: options.seed ?? 42,
		precisionMode: options.precisionMode ?? "maximum",
	});

	const suggestions = result.filters.map((filter) =>
		v4FilterToSuggestion(filter, result.measured1_12, result.target),
	);

	return {
		...mapV4ToLegacyResult(result),
		suggestions,
		v4: result,
	};
}

export function mapAutoEqV4ResultToPipeline(
	result: AutoEqV4Result,
): AutoEqResult & { suggestions: Suggestion[]; v4: AutoEqV4Result } {
	const suggestions = result.filters.map((filter) =>
		v4FilterToSuggestion(filter, result.measured1_12, result.target),
	);

	return {
		...mapV4ToLegacyResult(result),
		suggestions,
		v4: result,
	};
}

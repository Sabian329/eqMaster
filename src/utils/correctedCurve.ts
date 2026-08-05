import type { CurvePoint, Suggestion } from "../types";
import { getFilterResponseDb as getV2FilterResponseDb } from "../audio/auto-eq/biquad";
import { getFilterResponseDb as getV3FilterResponseDb } from "../audio/auto-eq/v3/biquadResponse";
import { qToBandwidthOctaves } from "./format";

const PREVIEW_SAMPLE_RATE = 48_000;

export interface BuildCorrectedCurveOptions {
	/** preview = Lorentzian PK (legacy UI); rbj = exact biquad used by Auto EQ V3 */
	responseModel?: "preview" | "rbj";
	sampleRate?: number;
	/** When false, do not clamp the summed curve (needed for predicted ≡ measured + EQ). */
	clampDisplay?: boolean;
}

/** Peaking-filter magnitude (dB) for EQ preview — matches PK / BW Oct preset shape. */
export function peakingFilterMagnitudeDb(
	frequency: number,
	centerFrequency: number,
	gainDb: number,
	q: number,
): number {
	if (frequency <= 0 || centerFrequency <= 0 || gainDb === 0) return 0;

	const bandwidthOctaves = Math.max(0.05, qToBandwidthOctaves(q));
	const logOffset = Math.log2(frequency / centerFrequency);
	const halfWidth = bandwidthOctaves / 2;
	const shape = 1 / (1 + (logOffset / halfWidth) ** 2);

	return gainDb * shape;
}

function filterMagnitudeDb(
	frequency: number,
	filter: Suggestion,
	options: Required<
		Pick<BuildCorrectedCurveOptions, "responseModel" | "sampleRate">
	>,
): number {
	if (filter.gain === null || filter.gain === 0) return 0;

	if (options.responseModel === "rbj") {
		return getV3FilterResponseDb(
			{
				type: filter.filterType ?? "PK",
				frequency: filter.frequency,
				gainDb: filter.gain,
				q: filter.q,
			},
			frequency,
			options.sampleRate,
		);
	}

	if (filter.filterType && filter.filterType !== "PK") {
		return getV2FilterResponseDb(
			{
				type: filter.filterType,
				frequency: filter.frequency,
				gainDb: filter.gain,
				q: filter.q,
			},
			frequency,
			options.sampleRate,
		);
	}

	return peakingFilterMagnitudeDb(
		frequency,
		filter.frequency,
		filter.gain,
		filter.q,
	);
}

export function buildCorrectedCurve(
	measuredCurve: CurvePoint[],
	suggestions: Suggestion[],
	preampDb: number,
	options: BuildCorrectedCurveOptions = {},
): CurvePoint[] {
	const responseModel = options.responseModel ?? "preview";
	const sampleRate = options.sampleRate ?? PREVIEW_SAMPLE_RATE;
	const clampDisplay = options.clampDisplay ?? responseModel !== "rbj";

	const safePreamp = Number.isFinite(preampDb)
		? Math.max(-30, Math.min(12, preampDb))
		: 0;

	const activeFilters = suggestions.filter((item) => {
		if (item.enabled === false) return false;
		if (item.kind === "null") return false;
		return item.gain !== null && item.gain !== 0;
	});

	return measuredCurve.map((point) => {
		let eqDb = safePreamp;
		for (const filter of activeFilters) {
			eqDb += filterMagnitudeDb(point.frequency, filter, {
				responseModel,
				sampleRate,
			});
		}

		const predictedDb = point.db + eqDb;
		return {
			frequency: point.frequency,
			db: clampDisplay
				? Math.max(-54, Math.min(18, predictedDb))
				: predictedDb,
		};
	});
}

/** Exact EQ-only response for identity checks: predicted - measured. */
export function buildCombinedFilterResponseCurve(
	measuredCurve: CurvePoint[],
	suggestions: Suggestion[],
	options: BuildCorrectedCurveOptions = {},
): CurvePoint[] {
	const responseModel = options.responseModel ?? "rbj";
	const sampleRate = options.sampleRate ?? PREVIEW_SAMPLE_RATE;

	const activeFilters = suggestions.filter((item) => {
		if (item.enabled === false) return false;
		if (item.kind === "null") return false;
		return item.gain !== null && item.gain !== 0;
	});

	return measuredCurve.map((point) => {
		let eqDb = 0;
		for (const filter of activeFilters) {
			eqDb += filterMagnitudeDb(point.frequency, filter, {
				responseModel,
				sampleRate,
			});
		}
		return { frequency: point.frequency, db: eqDb };
	});
}

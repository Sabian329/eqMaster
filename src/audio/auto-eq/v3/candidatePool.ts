import {
	FREQUENCY_OFFSETS_OCTAVES,
	GAIN_MULTIPLIERS,
	HF_TONAL_Q_VALUES,
	HIGH_HF_TONAL_GAIN_DB,
	MID_HF_TONAL_GAIN_DB,
	MIN_PROMINENCE_DB,
	Q_MULTIPLIERS,
	TONAL_Q_VALUES,
	V3_CANDIDATE_BUDGET,
} from "./constants";
import { getBroadCorrectionStrength } from "./broadRegion";
import { getCorrectionStrength } from "./correctionStrength";
import { clampFilterGain, clampFilterQ } from "./frequencyLimits";
import { clamp } from "./math";
import { applyTolerance, getTargetToleranceDb } from "./tolerance";
import {
	canBoostAtFrequency,
	clampFilterFrequency,
	clampFrequencyToOptions,
} from "./prepareMeasurement";
import type {
	AutoEqV3Options,
	FilterCandidate,
	FilterReason,
	GeneratedEqFilter,
	PreparedMeasurement,
	ResonanceCandidate,
	ShelfCandidate,
	TonalCandidate,
} from "./types";

let candidateCounter = 0;

export function resetCandidateCounter(): void {
	candidateCounter = 0;
}

export function createFilterId(): string {
	candidateCounter += 1;
	return `v3-filter-${candidateCounter}`;
}

function findNearestDb(
	points: { frequency: number; db: number }[],
	frequency: number,
): number {
	let best = points[0]?.db ?? 0;
	let bestDistance = Number.POSITIVE_INFINITY;
	for (const point of points) {
		const distance = Math.abs(Math.log2(point.frequency / frequency));
		if (distance < bestDistance) {
			bestDistance = distance;
			best = point.db;
		}
	}
	return best;
}

function createResonanceVariants(
	frequency: number,
	baseGainDb: number,
	baseQ: number,
	reason: FilterReason,
	confidence: number,
	prepared: PreparedMeasurement,
	options: AutoEqV3Options,
	highConfidenceRepeatedResonance: boolean,
): FilterCandidate[] {
	const candidates: FilterCandidate[] = [];
	const limitOptions = {
		measurementCount: prepared.measurementCount,
		highConfidenceRepeatedResonance,
	};

	for (const octaveOffset of FREQUENCY_OFFSETS_OCTAVES) {
		const candidateFrequency = clampFrequencyToOptions(
			frequency * 2 ** octaveOffset,
			options,
		);

		const isBoost = baseGainDb > 0;
		if (
			isBoost &&
			!canBoostAtFrequency(prepared, candidateFrequency, options)
		) {
			continue;
		}

		for (const qMultiplier of Q_MULTIPLIERS) {
			const q = clampFilterQ(
				baseQ * qMultiplier,
				candidateFrequency,
				baseGainDb,
				"PK",
				highConfidenceRepeatedResonance,
				limitOptions,
			);

			for (const gainMultiplier of GAIN_MULTIPLIERS) {
				const rawGain = baseGainDb * gainMultiplier;
				const gainDb = clampFilterGain(
					rawGain,
					candidateFrequency,
					"PK",
					limitOptions,
				);
				if (Math.abs(gainDb) < 0.25) continue;

				candidates.push({
					type: "PK",
					frequency: candidateFrequency,
					gainDb,
					q,
					reason,
					confidence,
					pool: "resonance",
				});
			}
		}
	}

	return candidates;
}

export function generateResonancePool(
	resonances: ResonanceCandidate[],
	prepared: PreparedMeasurement,
	options: AutoEqV3Options,
): FilterCandidate[] {
	const candidates: FilterCandidate[] = [];

	for (const resonance of resonances) {
		if (resonance.isPotentialNull) continue;

		// Above 1 kHz prefer broad tonal/shelf correction, not narrow resonance notches.
		if (
			resonance.frequency >= 1_000 &&
			resonance.reason !== "repeated-resonance" &&
			!resonance.isHighConfidenceRepeated
		) {
			continue;
		}

		const measuredDb = findNearestDb(prepared.detailed, resonance.frequency);
		const targetDb = findNearestDb(prepared.target, resonance.frequency);
		const rawError = measuredDb - targetDb;
		// Keep more of the resonance prominence below 1 kHz; apply full tolerance above.
		const toleranceDb =
			resonance.frequency < 1_000
				? Math.min(0.5, getTargetToleranceDb(resonance.frequency))
				: getTargetToleranceDb(resonance.frequency);
		const toleratedError = applyTolerance(rawError, toleranceDb);
		if (toleratedError < MIN_PROMINENCE_DB && resonance.prominenceDb < MIN_PROMINENCE_DB)
			continue;
		const measuredErrorDb = Math.max(toleratedError, resonance.prominenceDb);

		const strength = getCorrectionStrength(
			resonance.frequency,
			prepared.measurementCount,
			resonance.reliability,
		);
		const desiredGainDb = -measuredErrorDb * strength;
		const highConfidenceRepeated =
			Boolean(resonance.isHighConfidenceRepeated) &&
			prepared.measurementCount >= 3;
		const cutGain = clampFilterGain(
			desiredGainDb,
			resonance.frequency,
			"PK",
			{
				measurementCount: prepared.measurementCount,
				highConfidenceRepeatedResonance: highConfidenceRepeated,
			},
		);

		candidates.push(
			...createResonanceVariants(
				resonance.frequency,
				cutGain,
				resonance.q,
				resonance.reason,
				resonance.reliability,
				prepared,
				options,
				highConfidenceRepeated,
			),
		);
	}

	return limitPool(candidates, V3_CANDIDATE_BUDGET.resonance);
}

function shapeHighFrequencyTonalGain(
	frequency: number,
	rawGainDb: number,
	toleratedErrorDb: number,
	strongBroadCut = false,
): number {
	if (rawGainDb >= 0 || toleratedErrorDb < 1.25) return rawGainDb;

	// Strong broad excess (high positive coverage): allow deeper wide cuts.
	if (strongBroadCut) {
		if (frequency >= 1_000 && frequency < 5_000) {
			return clamp(rawGainDb, -4.0, -1.5);
		}
		if (frequency >= 5_000) {
			return clamp(rawGainDb, -3.5, -2.0);
		}
	}

	// Mid HF: one shallow wide cut around 1.5–3 kHz band.
	if (frequency >= 1_000 && frequency < 5_000) {
		return clamp(
			Math.min(rawGainDb, MID_HF_TONAL_GAIN_DB.max),
			MID_HF_TONAL_GAIN_DB.min,
			MID_HF_TONAL_GAIN_DB.max,
		);
	}

	// High HF: shallow wide cut / shelf in the -2…-3 dB band.
	if (frequency >= 5_000) {
		return clamp(
			Math.min(rawGainDb, HIGH_HF_TONAL_GAIN_DB.max),
			HIGH_HF_TONAL_GAIN_DB.min,
			HIGH_HF_TONAL_GAIN_DB.max,
		);
	}

	return rawGainDb;
}

export function generateTonalPool(
	tonalSegments: TonalCandidate[],
	prepared: PreparedMeasurement,
	options: AutoEqV3Options,
): FilterCandidate[] {
	const candidates: FilterCandidate[] = [];
	const limitOptions = { measurementCount: prepared.measurementCount };

	for (const segment of tonalSegments) {
		if (
			segment.reason === "low-frequency-tilt" ||
			segment.reason === "high-frequency-tilt"
		) {
			continue;
		}

		const toleratedError = applyTolerance(
			segment.errorDb,
			getTargetToleranceDb(segment.frequency),
		);
		if (Math.abs(toleratedError) < MIN_PROMINENCE_DB) continue;

		// Prefer mid-HF center in the 1.5–3 kHz trend band.
		let candidateFrequency = clampFrequencyToOptions(
			segment.frequency,
			options,
		);
		if (
			segment.errorDb > 0 &&
			candidateFrequency >= 1_000 &&
			candidateFrequency < 5_000
		) {
			candidateFrequency = clamp(candidateFrequency, 1_500, 3_000);
		}

		const coverage = segment.positiveErrorCoverage ?? 0;
		const strongBroadCut = Boolean(segment.qualifiesForStrongBroadCut);
		const strength = strongBroadCut
			? getBroadCorrectionStrength(coverage)
			: getCorrectionStrength(
					candidateFrequency,
					prepared.measurementCount,
					segment.reliability,
				);
		const shapedGain = shapeHighFrequencyTonalGain(
			candidateFrequency,
			-toleratedError * strength,
			Math.abs(toleratedError),
			strongBroadCut,
		);
		const baseGain = clampFilterGain(
			shapedGain,
			candidateFrequency,
			"PK",
			limitOptions,
		);

		const qValues =
			candidateFrequency >= 1_000 ? HF_TONAL_Q_VALUES : TONAL_Q_VALUES;

		for (const q of qValues) {
			const clampedQ = clampFilterQ(
				q,
				candidateFrequency,
				baseGain,
				"PK",
				false,
				limitOptions,
			);

			if (
				baseGain > 0 &&
				!canBoostAtFrequency(prepared, candidateFrequency, options)
			) {
				continue;
			}

			const gainDb = clampFilterGain(
				baseGain,
				candidateFrequency,
				"PK",
				limitOptions,
			);
			if (Math.abs(gainDb) < 0.25) continue;

			candidates.push({
				type: "PK",
				frequency: candidateFrequency,
				gainDb,
				q: clampedQ,
				reason: segment.reason,
				confidence: segment.reliability,
				pool: "tonal",
				positiveErrorCoverage: coverage,
				qualifiesForStrongBroadCut: strongBroadCut,
			});
		}
	}

	return limitPool(candidates, V3_CANDIDATE_BUDGET.tonal);
}

export function generateShelfPool(
	shelves: ShelfCandidate[],
	prepared: PreparedMeasurement,
	options: AutoEqV3Options,
): FilterCandidate[] {
	const candidates: FilterCandidate[] = [];
	const limitOptions = { measurementCount: prepared.measurementCount };

	for (const shelf of shelves) {
		const toleratedError = applyTolerance(
			shelf.errorDb,
			getTargetToleranceDb(shelf.frequency),
		);
		if (Math.abs(toleratedError) < MIN_PROMINENCE_DB) continue;

		const coverage = shelf.positiveErrorCoverage ?? 0;
		const strongBroadCut = Boolean(shelf.qualifiesForStrongBroadCut);
		const strength = strongBroadCut
			? getBroadCorrectionStrength(coverage)
			: getCorrectionStrength(
					shelf.frequency,
					prepared.measurementCount,
					shelf.reliability,
				);
		const shapedGain =
			shelf.type === "HS"
				? shapeHighFrequencyTonalGain(
						shelf.frequency,
						-toleratedError * strength,
						Math.abs(toleratedError),
						strongBroadCut,
					)
				: -toleratedError * strength;
		const gainDb = clampFilterGain(
			shapedGain,
			shelf.frequency,
			shelf.type,
			limitOptions,
		);

		if (
			gainDb > 0 &&
			!canBoostAtFrequency(prepared, shelf.frequency, options)
		) {
			continue;
		}

		if (Math.abs(gainDb) < 0.25) continue;

		candidates.push({
			type: shelf.type,
			frequency: clampFilterFrequency(
				shelf.frequency,
				shelf.type,
				shelf.reason,
				options,
			),
			gainDb,
			q: 0.707,
			reason: shelf.reason,
			confidence: shelf.reliability,
			pool: "shelf",
			positiveErrorCoverage: coverage,
			qualifiesForStrongBroadCut: strongBroadCut,
		});
	}

	return limitPool(candidates, V3_CANDIDATE_BUDGET.shelf);
}

function limitPool(
	candidates: FilterCandidate[],
	budget: number,
): FilterCandidate[] {
	const sorted = [...candidates].sort(
		(a, b) =>
			Math.abs(b.gainDb) * b.confidence - Math.abs(a.gainDb) * a.confidence,
	);
	return sorted.slice(0, budget);
}

export function mergeCandidatePools(
	resonance: FilterCandidate[],
	tonal: FilterCandidate[],
	shelf: FilterCandidate[],
): {
	resonance: FilterCandidate[];
	tonal: FilterCandidate[];
	shelf: FilterCandidate[];
	all: FilterCandidate[];
} {
	return {
		resonance: limitPool(resonance, V3_CANDIDATE_BUDGET.resonance),
		tonal: limitPool(tonal, V3_CANDIDATE_BUDGET.tonal),
		shelf: limitPool(shelf, V3_CANDIDATE_BUDGET.shelf),
		all: [
			...limitPool(resonance, V3_CANDIDATE_BUDGET.resonance),
			...limitPool(tonal, V3_CANDIDATE_BUDGET.tonal),
			...limitPool(shelf, V3_CANDIDATE_BUDGET.shelf),
		],
	};
}

export function candidateToFilter(
	candidate: FilterCandidate,
): GeneratedEqFilter {
	const bandwidth =
		candidate.type === "PK" ? 1 / Math.max(candidate.q, 0.1) : 1;
	const fromHz = candidate.frequency / 2 ** (bandwidth / 2);
	const toHz = candidate.frequency * 2 ** (bandwidth / 2);

	return {
		id: createFilterId(),
		type: candidate.type,
		frequency: candidate.frequency,
		gainDb: candidate.gainDb,
		q: candidate.q,
		enabled: true,
		confidence: candidate.confidence,
		improvementPercent: 0,
		contributionPercent: 0,
		affectedRange: { fromHz, toHz },
		reason: candidate.reason,
		positiveErrorCoverage: candidate.positiveErrorCoverage,
		qualifiesForStrongBroadCut: candidate.qualifiesForStrongBroadCut,
	};
}

export function cloneFilter(filter: GeneratedEqFilter): GeneratedEqFilter {
	return { ...filter, affectedRange: { ...filter.affectedRange } };
}

/** Keep shallow HF tonal / shelf cuts inside the intended gain bands. */
export function clampHighFrequencyTonalGain(
	filter: GeneratedEqFilter,
): GeneratedEqFilter {
	const clone = cloneFilter(filter);
	const isHfTonal =
		clone.reason === "broad-tonal-error" ||
		clone.reason === "high-frequency-tilt" ||
		clone.type === "HS";

	if (!isHfTonal || clone.gainDb >= 0) return clone;

	const strong = Boolean(clone.qualifiesForStrongBroadCut);
	if (clone.frequency >= 1_000 && clone.frequency < 5_000) {
		clone.gainDb = clamp(
			clone.gainDb,
			strong ? -4.0 : MID_HF_TONAL_GAIN_DB.min,
			strong ? -1.5 : MID_HF_TONAL_GAIN_DB.max,
		);
	} else if (clone.frequency >= 5_000 || clone.type === "HS") {
		clone.gainDb = clamp(
			clone.gainDb,
			strong ? -3.5 : HIGH_HF_TONAL_GAIN_DB.min,
			strong ? -2.0 : HIGH_HF_TONAL_GAIN_DB.max,
		);
	}

	return clone;
}

export function buildCandidatePools(
	prepared: PreparedMeasurement,
	options: AutoEqV3Options,
	resonances: ResonanceCandidate[],
	tonalSegments: TonalCandidate[],
	shelves: ShelfCandidate[],
): {
	resonance: FilterCandidate[];
	tonal: FilterCandidate[];
	shelf: FilterCandidate[];
	all: FilterCandidate[];
} {
	const resonance = generateResonancePool(resonances, prepared, options);
	const tonal = generateTonalPool(tonalSegments, prepared, options);
	const shelf = generateShelfPool(shelves, prepared, options);
	return mergeCandidatePools(resonance, tonal, shelf);
}

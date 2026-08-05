import {
	FREQUENCY_OFFSETS_OCTAVES,
	GAIN_MULTIPLIERS,
	MIN_PROMINENCE_DB,
	Q_MULTIPLIERS,
	TONAL_Q_VALUES,
	V3_CANDIDATE_BUDGET,
} from "./constants";
import { clampFilterGain, clampFilterQ } from "./frequencyLimits";
import {
	canBoostAtFrequency,
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

function createResonanceVariants(
	frequency: number,
	baseGainDb: number,
	baseQ: number,
	reason: FilterReason,
	confidence: number,
	prepared: PreparedMeasurement,
	options: AutoEqV3Options,
): FilterCandidate[] {
	const candidates: FilterCandidate[] = [];

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
				reason === "repeated-resonance",
			);

			for (const gainMultiplier of GAIN_MULTIPLIERS) {
				const rawGain = baseGainDb * gainMultiplier;
				const gainDb = clampFilterGain(rawGain, candidateFrequency, "PK");
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

		const measuredError =
			prepared.detailed.find(
				(point) =>
					Math.abs(Math.log2(point.frequency / resonance.frequency)) < 1 / 48,
			)?.db ?? 0;
		const targetDb =
			prepared.target.find(
				(point) =>
					Math.abs(Math.log2(point.frequency / resonance.frequency)) < 1 / 48,
			)?.db ?? 0;
		const excess = measuredError - targetDb;
		if (excess < MIN_PROMINENCE_DB) continue;

		const cutGain = clampFilterGain(-excess * 0.75, resonance.frequency, "PK");
		candidates.push(
			...createResonanceVariants(
				resonance.frequency,
				cutGain,
				resonance.q,
				resonance.reason,
				resonance.reliability,
				prepared,
				options,
			),
		);
	}

	return limitPool(candidates, V3_CANDIDATE_BUDGET.resonance);
}

export function generateTonalPool(
	tonalSegments: TonalCandidate[],
	prepared: PreparedMeasurement,
	options: AutoEqV3Options,
): FilterCandidate[] {
	const candidates: FilterCandidate[] = [];

	for (const segment of tonalSegments) {
		if (
			segment.reason === "low-frequency-tilt" ||
			segment.reason === "high-frequency-tilt"
		) {
			continue;
		}

		const baseGain = clampFilterGain(
			-segment.errorDb * 0.65,
			segment.frequency,
			"PK",
		);

		for (const q of TONAL_Q_VALUES) {
			const clampedQ = clampFilterQ(q, segment.frequency, baseGain, "PK");
			const candidateFrequency = clampFrequencyToOptions(
				segment.frequency,
				options,
			);

			if (
				baseGain > 0 &&
				!canBoostAtFrequency(prepared, candidateFrequency, options)
			) {
				continue;
			}

			const gainDb = clampFilterGain(baseGain, candidateFrequency, "PK");
			if (Math.abs(gainDb) < 0.25) continue;

			candidates.push({
				type: "PK",
				frequency: candidateFrequency,
				gainDb,
				q: clampedQ,
				reason: segment.reason,
				confidence: segment.reliability,
				pool: "tonal",
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

	for (const shelf of shelves) {
		const gainDb = clampFilterGain(
			-shelf.errorDb * (shelf.type === "LS" ? 0.55 : 0.5),
			shelf.frequency,
			shelf.type,
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
			frequency: clampFrequencyToOptions(shelf.frequency, options),
			gainDb,
			q: 0.707,
			reason: shelf.reason,
			confidence: shelf.reliability,
			pool: "shelf",
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
	};
}

export function cloneFilter(filter: GeneratedEqFilter): GeneratedEqFilter {
	return { ...filter, affectedRange: { ...filter.affectedRange } };
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

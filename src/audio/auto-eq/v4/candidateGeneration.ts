import {
	FREQUENCY_OFFSETS_OCTAVES,
	GAIN_MULTIPLIERS,
	MIN_PROMINENCE_DB,
	Q_MULTIPLIERS,
	SHELF_Q,
	TONAL_Q_VALUES,
	V4_CANDIDATE_BUDGET,
} from "./constants";
import { getV4CorrectionStrength } from "./correctionStrength";
import { clampFilterGain, clampFilterQ } from "./frequencyLimits";
import { applyTolerance, getTargetToleranceDb } from "./multiScaleCost";
import {
	canBoostAtFrequency,
	clampFilterFrequency,
	clampFrequencyToOptions,
} from "./prepareMeasurement";
import { getBroadCorrectionStrength } from "./tonalRegionDetection";
import type {
	AutoEqV4Options,
	FrequencyPoint,
	PreparedV4Measurement,
	V4FilterCandidate,
	V4FilterReason,
	V4GeneratedFilter,
	V4ResonanceCandidate,
	V4ShelfCandidate,
	V4TonalRegion,
} from "./types";

let candidateCounter = 0;

export function resetV4CandidateCounter(): void {
	candidateCounter = 0;
}

export function createV4FilterId(): string {
	candidateCounter += 1;
	return `v4-filter-${candidateCounter}`;
}

function findNearestDb(points: FrequencyPoint[], frequency: number): number {
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

function limitPool(candidates: V4FilterCandidate[], budget: number): V4FilterCandidate[] {
	const sorted = [...candidates].sort(
		(a, b) => Math.abs(b.gainDb) * b.confidence - Math.abs(a.gainDb) * a.confidence,
	);
	return sorted.slice(0, budget);
}

function createResonanceVariants(
	frequency: number,
	baseGainDb: number,
	baseQ: number,
	reason: V4FilterReason,
	confidence: number,
	prepared: PreparedV4Measurement,
	options: AutoEqV4Options,
	highConfidenceRepeated: boolean,
): V4FilterCandidate[] {
	const candidates: V4FilterCandidate[] = [];
	const limitOptions = {
		measurementCount: prepared.measurementCount,
		highConfidenceRepeatedResonance: highConfidenceRepeated,
	};

	for (const octaveOffset of FREQUENCY_OFFSETS_OCTAVES) {
		const candidateFrequency = clampFrequencyToOptions(frequency * 2 ** octaveOffset, options);
		const isBoost = baseGainDb > 0;
		if (isBoost && !canBoostAtFrequency(prepared, candidateFrequency, options)) continue;

		for (const qMultiplier of Q_MULTIPLIERS) {
			const q = clampFilterQ(
				baseQ * qMultiplier,
				candidateFrequency,
				baseGainDb,
				"PK",
				highConfidenceRepeated,
				limitOptions,
			);

			for (const gainMultiplier of GAIN_MULTIPLIERS) {
				const gainDb = clampFilterGain(baseGainDb * gainMultiplier, candidateFrequency, "PK", limitOptions);
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
	resonances: V4ResonanceCandidate[],
	prepared: PreparedV4Measurement,
	options: AutoEqV4Options,
): V4FilterCandidate[] {
	const candidates: V4FilterCandidate[] = [];

	for (const resonance of resonances) {
		if (resonance.isPotentialNull) continue;
		if (resonance.isSingleBinArtifact) continue;
		if (resonance.score <= 0) continue;
		// High-frequency resonances require stronger persistence / repeatability.
		if (
			resonance.frequency >= 1_000 &&
			resonance.reason !== "repeated-resonance" &&
			(resonance.scalePersistence ?? 0) < 0.65
		) {
			continue;
		}

		const measuredDb = findNearestDb(prepared.octave1_12, resonance.frequency);
		const targetDb = findNearestDb(prepared.target, resonance.frequency);
		const rawError = measuredDb - targetDb;
		const toleranceDb =
			resonance.frequency < 1_000
				? Math.min(0.5, getTargetToleranceDb(resonance.frequency))
				: getTargetToleranceDb(resonance.frequency);
		const toleratedError = applyTolerance(rawError, toleranceDb);
		if (toleratedError < MIN_PROMINENCE_DB && resonance.prominenceDb < MIN_PROMINENCE_DB) continue;
		const measuredErrorDb = Math.max(toleratedError, resonance.prominenceDb);

		const strength = getV4CorrectionStrength(
			resonance.frequency,
			prepared.measurementCount,
			resonance.reliability,
			resonance.scalePersistence ?? 1,
		);
		const desiredGainDb = -measuredErrorDb * strength;
		const highConfidenceRepeated = resonance.reason === "repeated-resonance";
		const cutGain = clampFilterGain(desiredGainDb, resonance.frequency, "PK", {
			measurementCount: prepared.measurementCount,
			highConfidenceRepeatedResonance: highConfidenceRepeated,
		});

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

	return limitPool(candidates, V4_CANDIDATE_BUDGET.resonance);
}

export function generateTonalPool(
	regions: V4TonalRegion[],
	prepared: PreparedV4Measurement,
	options: AutoEqV4Options,
): V4FilterCandidate[] {
	const candidates: V4FilterCandidate[] = [];
	const limitOptions = { measurementCount: prepared.measurementCount };

	for (const region of regions) {
		if (region.frequency < 250 || region.frequency > 5_000) continue;

		const toleratedError = applyTolerance(region.errorDb, getTargetToleranceDb(region.frequency));
		if (Math.abs(toleratedError) < MIN_PROMINENCE_DB) continue;

		const candidateFrequency = clampFrequencyToOptions(region.frequency, options);
		const strongCut = region.positiveErrorCoverage >= 0.8 && region.averageExcessDb > 2;
		const strength = strongCut
			? getBroadCorrectionStrength(region.positiveErrorCoverage)
			: getV4CorrectionStrength(candidateFrequency, prepared.measurementCount, region.reliability);
		const baseGain = clampFilterGain(-toleratedError * strength, candidateFrequency, "PK", limitOptions);

		for (const q of TONAL_Q_VALUES) {
			const clampedQ = clampFilterQ(q, candidateFrequency, baseGain, "PK", false, limitOptions);
			if (baseGain > 0 && !canBoostAtFrequency(prepared, candidateFrequency, options)) continue;

			const gainDb = clampFilterGain(baseGain, candidateFrequency, "PK", limitOptions);
			if (Math.abs(gainDb) < 0.25) continue;

			candidates.push({
				type: "PK",
				frequency: candidateFrequency,
				gainDb,
				q: clampedQ,
				reason: "broad-tonal-excess",
				confidence: region.reliability,
				pool: "tonal",
				positiveErrorCoverage: region.positiveErrorCoverage,
			});
		}
	}

	return limitPool(candidates, V4_CANDIDATE_BUDGET.tonal);
}

export function generateShelfPool(
	shelves: V4ShelfCandidate[],
	prepared: PreparedV4Measurement,
	options: AutoEqV4Options,
): V4FilterCandidate[] {
	const candidates: V4FilterCandidate[] = [];
	const limitOptions = { measurementCount: prepared.measurementCount };

	for (const shelf of shelves) {
		const toleratedError = applyTolerance(shelf.errorDb, getTargetToleranceDb(shelf.frequency));
		if (Math.abs(toleratedError) < MIN_PROMINENCE_DB) continue;

		const strongCut = shelf.positiveErrorCoverage >= 0.8 && shelf.averageExcessDb > 2;
		const strength = strongCut
			? getBroadCorrectionStrength(shelf.positiveErrorCoverage)
			: getV4CorrectionStrength(shelf.frequency, prepared.measurementCount, shelf.reliability);
		const gainDb = clampFilterGain(-toleratedError * strength, shelf.frequency, shelf.type, limitOptions);
		if (gainDb > 0 && !canBoostAtFrequency(prepared, shelf.frequency, options)) continue;
		if (Math.abs(gainDb) < 0.25) continue;

		const reason: V4FilterReason =
			shelf.type === "LS" ? "low-frequency-tilt" : "high-frequency-tilt";
		candidates.push({
			type: shelf.type,
			frequency: clampFilterFrequency(shelf.frequency, shelf.type, reason, options),
			gainDb,
			q: SHELF_Q,
			reason,
			confidence: shelf.reliability,
			pool: "shelf",
			positiveErrorCoverage: shelf.positiveErrorCoverage,
		});
	}

	return limitPool(candidates, V4_CANDIDATE_BUDGET.shelf);
}

export function buildV4CandidatePools(
	prepared: PreparedV4Measurement,
	options: AutoEqV4Options,
	resonances: V4ResonanceCandidate[],
	tonalRegions: V4TonalRegion[],
	shelves: V4ShelfCandidate[],
): { resonance: V4FilterCandidate[]; tonal: V4FilterCandidate[]; shelf: V4FilterCandidate[]; all: V4FilterCandidate[] } {
	const resonance = generateResonancePool(resonances, prepared, options);
	const tonal = generateTonalPool(tonalRegions, prepared, options);
	const shelf = generateShelfPool(shelves, prepared, options);
	return { resonance, tonal, shelf, all: [...resonance, ...tonal, ...shelf] };
}

export function candidateToFilter(candidate: V4FilterCandidate): V4GeneratedFilter {
	const bandwidth = candidate.type === "PK" ? 1 / Math.max(candidate.q, 0.1) : 1;
	const fromHz = candidate.frequency / 2 ** (bandwidth / 2);
	const toHz = candidate.frequency * 2 ** (bandwidth / 2);

	return {
		id: createV4FilterId(),
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
		scalePersistence: candidate.scalePersistence,
		positiveErrorCoverage: candidate.positiveErrorCoverage,
	};
}

export function cloneV4Filter(filter: V4GeneratedFilter): V4GeneratedFilter {
	return { ...filter, affectedRange: { ...filter.affectedRange } };
}

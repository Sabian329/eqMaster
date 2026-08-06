import { getCombinedFilterResponseDb } from "./biquadResponse";
import type {
	FilterCandidate,
	FrequencyPoint,
	GeneratedEqFilter,
} from "./types";

export function distanceOctaves(
	leftFrequency: number,
	rightFrequency: number,
): number {
	return Math.abs(Math.log2(leftFrequency / rightFrequency));
}

export function responseCorrelation(
	left: GeneratedEqFilter | FilterCandidate,
	right: GeneratedEqFilter | FilterCandidate,
	grid: FrequencyPoint[],
	sampleRate: number,
): number {
	const leftFilter: GeneratedEqFilter =
		"id" in left
			? left
			: {
					id: "temp-left",
					type: left.type,
					frequency: left.frequency,
					gainDb: left.gainDb,
					q: left.q,
					enabled: true,
					confidence: left.confidence,
					improvementPercent: 0,
					contributionPercent: 0,
					affectedRange: { fromHz: left.frequency, toHz: left.frequency },
					reason: left.reason,
				};

	const rightFilter: GeneratedEqFilter =
		"id" in right
			? right
			: {
					id: "temp-right",
					type: right.type,
					frequency: right.frequency,
					gainDb: right.gainDb,
					q: right.q,
					enabled: true,
					confidence: right.confidence,
					improvementPercent: 0,
					contributionPercent: 0,
					affectedRange: { fromHz: right.frequency, toHz: right.frequency },
					reason: right.reason,
				};

	const leftResponse = grid.map((point) =>
		getCombinedFilterResponseDb([leftFilter], point.frequency, sampleRate),
	);
	const rightResponse = grid.map((point) =>
		getCombinedFilterResponseDb([rightFilter], point.frequency, sampleRate),
	);

	const leftMean =
		leftResponse.reduce((sum, value) => sum + value, 0) / leftResponse.length;
	const rightMean =
		rightResponse.reduce((sum, value) => sum + value, 0) / rightResponse.length;

	let numerator = 0;
	let leftDenominator = 0;
	let rightDenominator = 0;

	for (let index = 0; index < leftResponse.length; index += 1) {
		const leftDelta = leftResponse[index] - leftMean;
		const rightDelta = rightResponse[index] - rightMean;
		numerator += leftDelta * rightDelta;
		leftDenominator += leftDelta * leftDelta;
		rightDenominator += rightDelta * rightDelta;
	}

	const denominator = Math.sqrt(leftDenominator * rightDenominator);
	return denominator > 0 ? numerator / denominator : 0;
}

export function hasCancellationRisk(
	left: GeneratedEqFilter | FilterCandidate,
	right: GeneratedEqFilter | FilterCandidate,
): boolean {
	const distance = distanceOctaves(left.frequency, right.frequency);
	if (distance >= 1 / 8) return false;
	return Math.sign(left.gainDb) !== Math.sign(right.gainDb);
}

function candidateAffectedRange(candidate: FilterCandidate): {
	fromHz: number;
	toHz: number;
} {
	const bandwidth =
		candidate.type === "PK" ? 1 / Math.max(candidate.q, 0.1) : 1;
	return {
		fromHz: candidate.frequency / 2 ** (bandwidth / 2),
		toHz: candidate.frequency * 2 ** (bandwidth / 2),
	};
}

function overlapOctavesBetween(
	leftFromHz: number,
	leftToHz: number,
	rightFromHz: number,
	rightToHz: number,
): number {
	const leftFrom = Math.log2(leftFromHz);
	const leftTo = Math.log2(leftToHz);
	const rightFrom = Math.log2(rightFromHz);
	const rightTo = Math.log2(rightToHz);
	return Math.max(0, Math.min(leftTo, rightTo) - Math.max(leftFrom, rightFrom));
}

export function removeOverlappingTonalFilters(
	filters: GeneratedEqFilter[],
	grid: FrequencyPoint[],
	sampleRate: number,
): GeneratedEqFilter[] {
	const sorted = [...filters].sort(
		(a, b) => Math.abs(b.gainDb) - Math.abs(a.gainDb),
	);
	const kept: GeneratedEqFilter[] = [];

	for (const filter of sorted) {
		const isTonal =
			filter.reason === "broad-tonal-error" ||
			filter.reason === "low-frequency-tilt" ||
			filter.reason === "high-frequency-tilt";

		const conflicts = kept.some((existing) => {
			const existingTonal =
				existing.reason === "broad-tonal-error" ||
				existing.reason === "low-frequency-tilt" ||
				existing.reason === "high-frequency-tilt";
			if (!isTonal || !existingTonal) return false;
			const distance = distanceOctaves(filter.frequency, existing.frequency);
			if (
				filter.frequency >= 1_000 &&
				existing.frequency >= 1_000 &&
				distance < 0.75
			) {
				return true;
			}
			const correlation = responseCorrelation(
				filter,
				existing,
				grid,
				sampleRate,
			);
			return correlation > 0.85 && distance < 1;
		});

		if (!conflicts) kept.push(filter);
	}

	return kept.sort((a, b) => a.frequency - b.frequency);
}

export function rejectSimilarCandidates(
	candidates: FilterCandidate[],
	existing: GeneratedEqFilter[],
	grid: FrequencyPoint[],
	sampleRate: number,
	minDistanceOctaves = 1 / 24,
	maxCorrelation = 0.92,
): FilterCandidate[] {
	return candidates.filter((candidate) => {
		const candidateRange = candidateAffectedRange(candidate);

		for (const filter of existing) {
			const distance = distanceOctaves(candidate.frequency, filter.frequency);
			if (distance < minDistanceOctaves) return false;

			const correlation = responseCorrelation(
				candidate,
				filter,
				grid,
				sampleRate,
			);

			if (distance < 1 / 12) {
				if (
					correlation > maxCorrelation &&
					Math.sign(candidate.gainDb) === Math.sign(filter.gainDb)
				) {
					return false;
				}
			}

			const bothTonal =
				(candidate.pool === "tonal" || candidate.pool === "shelf") &&
				(filter.reason === "broad-tonal-error" ||
					filter.reason === "low-frequency-tilt" ||
					filter.reason === "high-frequency-tilt");

			if (bothTonal) {
				const overlap = overlapOctavesBetween(
					candidateRange.fromHz,
					candidateRange.toHz,
					filter.affectedRange.fromHz,
					filter.affectedRange.toHz,
				);
				if (correlation > 0.85 && overlap > 0.5) {
					return false;
				}
			}

			if (
				candidate.frequency >= 1_000 &&
				filter.frequency >= 1_000 &&
				candidate.gainDb < 0 &&
				filter.gainDb < 0 &&
				distance < 0.75 &&
				correlation > 0.8
			) {
				return false;
			}

			if (hasCancellationRisk(candidate, filter)) {
				return false;
			}
		}
		return true;
	});
}

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

export function rejectSimilarCandidates(
	candidates: FilterCandidate[],
	existing: GeneratedEqFilter[],
	grid: FrequencyPoint[],
	sampleRate: number,
	minDistanceOctaves = 1 / 24,
	maxCorrelation = 0.92,
): FilterCandidate[] {
	return candidates.filter((candidate) => {
		for (const filter of existing) {
			const distance = distanceOctaves(candidate.frequency, filter.frequency);
			if (distance < minDistanceOctaves) return false;

			if (distance < 1 / 12) {
				const correlation = responseCorrelation(
					candidate,
					filter,
					grid,
					sampleRate,
				);
				if (
					correlation > maxCorrelation &&
					Math.sign(candidate.gainDb) === Math.sign(filter.gainDb)
				) {
					return false;
				}
			}

			if (hasCancellationRisk(candidate, filter)) {
				return false;
			}
		}
		return true;
	});
}

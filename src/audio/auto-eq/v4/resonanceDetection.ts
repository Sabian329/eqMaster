import {
	MIN_PROMINENCE_DB,
	MIN_RELIABILITY,
	MIN_RESONANCE_TARGET_EXCESS_DB,
	NULL_DEPTH_DB,
	NULL_MAX_BANDWIDTH_OCT,
} from "./constants";
import { getMinimumScalePersistence } from "./correctionStrength";
import {
	clamp,
	findHalfHeightBounds,
	frequencyWeight,
	parabolicPeakFrequency,
	qFromBandwidthOctaves,
} from "./math";
import { isSingleBinArtifact } from "./nullDetection";
import { singleMeasurementReliability } from "./prepareMeasurement";
import type { PreparedV4Measurement, V4FilterReason, V4ResonanceCandidate } from "./types";

/**
 * Local peaks/nulls on the fine residual (native 1/24 − 1/12) and on the
 * 1/12−target error. Peak Fc is refined with parabolic interpolation on the
 * log2 axis. Scale persistence prefers features that remain after coarser
 * smoothing, without hard-rejecting genuine bass modes that are already
 * captured by the 1/12 curve.
 */
export function detectResonances(
	prepared: PreparedV4Measurement,
): V4ResonanceCandidate[] {
	const {
		grid,
		target,
		narrowResidual,
		native1_24,
		octave1_12,
		octave1_6,
		reliability,
		repeatabilityDb,
		measurementCount,
		analysisPoints,
	} = prepared;

	const frequencies = grid.map((point) => point.frequency);
	const narrowValues = narrowResidual.map((point) => point.db);
	const fineError = octave1_12.map((point, index) => point.db - target[index].db);
	const nativeError = native1_24.map((point, index) => point.db - target[index].db);
	const midResidual = octave1_12.map((point, index) => point.db - octave1_6[index].db);
	const candidates: V4ResonanceCandidate[] = [];

	for (let index = 1; index < grid.length - 1; index += 1) {
		if (analysisPoints[index].isCombArtifact) continue;

		const frequency = grid[index].frequency;
		const narrowDb = narrowValues[index];
		const errorDb = fineError[index];
		const rel = reliability[index];

		const isNarrowPeak =
			narrowDb > narrowValues[index - 1] &&
			narrowDb > narrowValues[index + 1] &&
			narrowDb >= MIN_PROMINENCE_DB &&
			errorDb >= MIN_RESONANCE_TARGET_EXCESS_DB * 0.5;

		// Fine-scale modal peaks when the feature already lives in 1/12
		// (narrow residual is weak). On a dense grid, only require a strict
		// local maximum — prominence is enforced via errorDb thresholds.
		const isFinePeak =
			errorDb > fineError[index - 1] &&
			errorDb > fineError[index + 1] &&
			errorDb >= MIN_RESONANCE_TARGET_EXCESS_DB &&
			nativeError[index] >= MIN_RESONANCE_TARGET_EXCESS_DB &&
			narrowDb < MIN_PROMINENCE_DB;

		const isPotentialNull =
			((narrowDb < narrowValues[index - 1] && narrowDb < narrowValues[index + 1]) ||
				(errorDb < fineError[index - 1] && errorDb < fineError[index + 1])) &&
			errorDb <= -NULL_DEPTH_DB;

		if (!isNarrowPeak && !isFinePeak && !isPotentialNull) continue;

		const peakValues = isNarrowPeak && narrowDb >= errorDb * 0.5 ? narrowValues : fineError;
		const prominenceDb = isPotentialNull
			? Math.abs(errorDb)
			: Math.max(narrowDb, errorDb);
		if (prominenceDb < MIN_PROMINENCE_DB && !isPotentialNull) continue;
		if (rel < MIN_RELIABILITY && measurementCount > 1) continue;

		const bounds = findHalfHeightBounds(
			peakValues,
			frequencies,
			index,
			Math.max(prominenceDb * 0.5, MIN_PROMINENCE_DB * 0.5),
		);
		const bandwidthOctaves = Math.log2(
			bounds.upperFrequency / Math.max(bounds.lowerFrequency, 1),
		);
		const singleBin = isSingleBinArtifact(bandwidthOctaves);

		const refinedFrequency = parabolicPeakFrequency(frequencies, peakValues, index);
		const q = qFromBandwidthOctaves(bandwidthOctaves);

		// Persistence across scales: feature should remain meaningful at 1/12 and
		// not vanish completely at 1/6 (unless it is a very sharp LF mode).
		const fineRatio =
			Math.abs(nativeError[index]) > 1e-6
				? clamp(Math.abs(errorDb) / Math.abs(nativeError[index]), 0, 1.5)
				: 0;
		const midRatio =
			Math.abs(errorDb) > 1e-6
				? clamp(Math.abs(midResidual[index]) / Math.abs(errorDb), 0, 1.5)
				: 0;
		const sameSignFine =
			Math.sign(errorDb) === Math.sign(nativeError[index]) || Math.abs(errorDb) < 0.25;
		const scalePersistence = sameSignFine
			? clamp(0.55 * fineRatio + 0.45 * Math.max(midRatio, fineRatio * 0.7), 0, 1)
			: clamp(fineRatio * 0.35, 0, 1);

		const spatialPersistence =
			measurementCount > 1
				? clamp(1.2 - repeatabilityDb[index] / 2.5, 0.15, 1)
				: frequency < 1_000
					? 0.85
					: 0.55;

		if (isPotentialNull) {
			if (bandwidthOctaves >= NULL_MAX_BANDWIDTH_OCT) continue;
			candidates.push({
				frequency: refinedFrequency,
				prominenceDb,
				bandwidthOctaves,
				q,
				score: prominenceDb * rel,
				reason: "modal-resonance",
				reliability: rel,
				isPotentialNull: true,
				scalePersistence,
				spatialPersistence,
				isCombArtifact: false,
				isSingleBinArtifact: singleBin,
			});
			continue;
		}

		if (singleBin && !(frequency < 200 && prominenceDb >= 6 && measurementCount >= 3)) {
			candidates.push({
				frequency: refinedFrequency,
				prominenceDb,
				bandwidthOctaves,
				q,
				score: 0,
				reason: "modal-resonance",
				reliability: rel,
				isPotentialNull: false,
				scalePersistence,
				spatialPersistence,
				isCombArtifact: false,
				isSingleBinArtifact: true,
			});
			continue;
		}

		const minPersistence = getMinimumScalePersistence(frequency);
		// Soft gate: below threshold, keep only strong LF / high-prominence peaks.
		if (scalePersistence < minPersistence) {
			const allowWeakPersistence =
				(frequency < 300 && prominenceDb >= 3) ||
				(frequency < 1_000 && prominenceDb >= 4 && scalePersistence >= minPersistence * 0.5);
			if (!allowWeakPersistence) continue;
		}

		const repeatabilityFactor = clamp(1.5 - repeatabilityDb[index] / 3, 0.35, 1.25);
		const singleFactor = singleMeasurementReliability(frequency, measurementCount);
		const effectivePersistence = Math.max(scalePersistence, frequency < 300 ? 0.45 : 0.25);
		const score =
			prominenceDb *
			rel *
			effectivePersistence *
			spatialPersistence *
			repeatabilityFactor *
			singleFactor *
			frequencyWeight(frequency) *
			Math.sqrt(Math.max(bandwidthOctaves, 1 / 48));

		const isHighConfidenceRepeated =
			measurementCount >= 3 &&
			repeatabilityDb[index] < 1 &&
			rel > 0.75 &&
			singleFactor > 0.75 &&
			scalePersistence > 0.75 &&
			spatialPersistence > 0.75;

		const reason: V4FilterReason = isHighConfidenceRepeated
			? "repeated-resonance"
			: scalePersistence >= 0.65
				? "persistent-local-resonance"
				: "modal-resonance";

		candidates.push({
			frequency: refinedFrequency,
			prominenceDb,
			bandwidthOctaves,
			q,
			score,
			reason,
			reliability: rel,
			isPotentialNull: false,
			scalePersistence: effectivePersistence,
			spatialPersistence,
			isCombArtifact: false,
			isSingleBinArtifact: false,
		});
	}

	candidates.sort((a, b) => b.score - a.score);

	const deduped: V4ResonanceCandidate[] = [];
	for (const candidate of candidates) {
		const tooClose = deduped.some(
			(existing) =>
				Math.abs(Math.log2(existing.frequency / candidate.frequency)) < 1 / 24,
		);
		if (!tooClose) deduped.push(candidate);
	}

	return deduped;
}

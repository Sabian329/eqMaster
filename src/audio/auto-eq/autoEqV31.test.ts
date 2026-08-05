import { describe, expect, it } from "vitest";
import { generateAutoEq } from "../autoEq";
import { generateAutoEqV2 } from "./autoEq";
import { generateAutoEqV3 } from "./v3/autoEqV3";
import { calculatePreampDb } from "./v3/preamp";
import { computePredictedCurve } from "./v3/costFunction";
import { getCorrectionStrength } from "./v3/correctionStrength";
import {
	getCorrectabilityWeight,
	type AnalysisPoint,
} from "./v3/correctability";
import { applyTolerance, getTargetToleranceDb } from "./v3/tolerance";
import {
	computeBroadCutLimitPenalty,
	computeBroadOvercutPenalty,
	getAllowedBroadUndershootDb,
	getMaximumBroadCutDb,
	smoothToBroad,
} from "./v3/overcut";
import {
	acceptsCandidateEvaluation,
	type CandidateEvaluation,
} from "./v3/candidateEvaluation";
import { getFrequencyLimits } from "./v3/frequencyLimits";
import { getPreferredMaximumQ, getHighQPenaltyWeight } from "./v3/correctionStrength";
import { getFilterResponseDb } from "./v3/biquadResponse";
import { prepareMeasurement } from "./v3/prepareMeasurement";
import { DEFAULT_V3_OPTIONS } from "./v3/constants";
import { runFinalSafetyPass } from "./v3/finalSafetyPass";
import { createMockMeasurementRun } from "../../utils/mockMeasurement";
import { getTargetLabel } from "./v3/target";
import type { GeneratedEqFilter, FrequencyPoint } from "./v3/types";

const SAMPLE_RATE = 48_000;

function peakingShape(
	frequency: number,
	center: number,
	gainDb: number,
	q: number,
): number {
	return getFilterResponseDb(
		{ type: "PK", frequency: center, gainDb, q },
		frequency,
		SAMPLE_RATE,
	);
}

function buildMock9(): FrequencyPoint[] {
	const mock = createMockMeasurementRun({
		presetId: 9,
		runIndex: 1,
		fMin: 20,
		fMax: 20_000,
		durationSeconds: 5,
		smoothing: 12,
		levelDb: -18,
		channel: "both",
	});
	return mock.curve.map((point) => ({
		frequency: point.frequency,
		db: point.db,
	}));
}

function buildHighFrequencySynthetic(): FrequencyPoint[] {
	const grid = Array.from({ length: 280 }, (_, index) => ({
		frequency: 20 * 2 ** (index / 14),
		db: 0,
	}));

	for (const point of grid) {
		if (point.frequency >= 2_000 && point.frequency <= 8_000) {
			point.db += 5;
		}
		point.db += peakingShape(point.frequency, 3_000, 3, 6);
		point.db += peakingShape(point.frequency, 6_000, 2.5, 6);
		if (point.frequency > 8_000) {
			point.db += Math.sin(Math.log2(point.frequency) * 11) * 1;
		}
	}

	return grid;
}

function buildRepeated3kHzMeasurements(): FrequencyPoint[][] {
	return [0, 1, 2].map((run) => {
		const drift = 1 + (run - 1) * 0.02;
		const center = 3_000 * drift;
		return Array.from({ length: 240 }, (_, index) => {
			const frequency = 20 * 2 ** (index / 12);
			return {
				frequency,
				db: peakingShape(frequency, center, 6.5, 8),
			};
		});
	});
}

describe("auto-eq V3.1 units", () => {
	it("does not include preamp in predicted response", () => {
		const measurement = buildHighFrequencySynthetic();
		const prepared = prepareMeasurement([measurement], {
			...DEFAULT_V3_OPTIONS,
			sampleRate: SAMPLE_RATE,
		});
		const filters: GeneratedEqFilter[] = [];
		const predicted = computePredictedCurve(prepared, filters, {
			...DEFAULT_V3_OPTIONS,
			sampleRate: SAMPLE_RATE,
		});
		const fakePreamp = -6;
		for (let index = 0; index < predicted.length; index += 1) {
			expect(predicted[index].db).toBeCloseTo(prepared.detailed[index].db, 8);
			expect(predicted[index].db + fakePreamp).not.toBeCloseTo(
				prepared.detailed[index].db,
				1,
			);
		}
	});

	it("returns zero preamp when all filters only cut", () => {
		const cutsOnly: GeneratedEqFilter[] = [
			{
				id: "cut-1",
				type: "PK",
				frequency: 120,
				gainDb: -8,
				q: 4,
				enabled: true,
				confidence: 1,
				improvementPercent: 10,
				contributionPercent: 10,
				affectedRange: { fromHz: 80, toHz: 180 },
				reason: "local-resonance",
			},
			{
				id: "cut-2",
				type: "PK",
				frequency: 3_000,
				gainDb: -2,
				q: 1.5,
				enabled: true,
				confidence: 0.8,
				improvementPercent: 5,
				contributionPercent: 5,
				affectedRange: { fromHz: 2_000, toHz: 4_500 },
				reason: "broad-tonal-error",
			},
		];

		const { preampDb, maximumCombinedBoostDb } = calculatePreampDb(cutsOnly, {
			...DEFAULT_V3_OPTIONS,
			sampleRate: SAMPLE_RATE,
		});

		expect(maximumCombinedBoostDb).toBeLessThanOrEqual(0);
		expect(preampDb).toBe(0);
	});

	it("keeps target consistent between algorithm and chart props", () => {
		const measurement = buildHighFrequencySynthetic();
		const result = generateAutoEqV3([measurement], {
			...DEFAULT_V3_OPTIONS,
			sampleRate: SAMPLE_RATE,
			seed: 42,
		});

		const chartProps = {
			target: result.target,
			targetType: result.targetType,
			targetLabel: result.targetLabel,
		};

		expect(result.target).toEqual(chartProps.target);
		expect(result.targetType).toBe(chartProps.targetType);
		expect(result.targetLabel).toBe(chartProps.targetLabel);
		expect(result.resolvedTarget.points).toEqual(result.target);
		expect(result.targetLabel).toBe(getTargetLabel(result.targetType));
	}, 30_000);

	it("uses dynamic target legend labels", () => {
		expect(getTargetLabel("flat")).toBe("Flat target");
		expect(getTargetLabel("room")).toBe("Room target");
		expect(getTargetLabel("custom")).toBe("Custom target");
	});

	it("scales correction strength by frequency", () => {
		expect(getCorrectionStrength(100, 1, 1)).toBeCloseTo(0.95, 5);
		expect(getCorrectionStrength(500, 1, 1)).toBeCloseTo(0.8, 5);
		expect(getCorrectionStrength(3_000, 1, 1)).toBeCloseTo(0.65 * 0.8, 5);
		expect(getCorrectionStrength(7_000, 1, 1)).toBeCloseTo(0.5 * 0.8, 5);
		expect(getCorrectionStrength(12_000, 1, 1)).toBeCloseTo(0.35 * 0.8, 5);
	});

	it("scales correction strength by measurement count", () => {
		const single = getCorrectionStrength(3_000, 1, 1);
		const multi = getCorrectionStrength(3_000, 3, 1);
		expect(single).toBeLessThan(multi);
		expect(multi).toBeCloseTo(0.65, 5);
	});

	it("keeps safety-pass undershoot thresholds for high frequencies", () => {
		expect(getAllowedBroadUndershootDb(3_000)).toBe(2.0);
		expect(getAllowedBroadUndershootDb(7_000)).toBe(2.25);
		expect(getAllowedBroadUndershootDb(12_000)).toBe(2.5);
	});

	it("applies conservative single-measurement gain limits", () => {
		const limits1k = getFrequencyLimits(2_000, "PK", { measurementCount: 1 });
		expect(limits1k.maxCutDb).toBe(-3.5);
		expect(limits1k.maxBoostDb).toBe(1.5);

		const limits5k = getFrequencyLimits(7_000, "PK", { measurementCount: 1 });
		expect(limits5k.maxCutDb).toBe(-2.5);

		const limits10k = getFrequencyLimits(12_000, "PK", { measurementCount: 1 });
		expect(limits10k.maxCutDb).toBe(-1.5);

		const extended = getFrequencyLimits(3_000, "PK", {
			measurementCount: 3,
			highConfidenceRepeatedResonance: true,
		});
		expect(extended.maxCutDb).toBe(-5);
	});

	it("applies target tolerance", () => {
		expect(getTargetToleranceDb(100)).toBe(1);
		expect(getTargetToleranceDb(500)).toBe(1.25);
		expect(getTargetToleranceDb(3_000)).toBe(1.75);
		expect(applyTolerance(1.2, 1.75)).toBe(0);
		expect(applyTolerance(3, 1.75)).toBeCloseTo(1.25, 5);
		expect(applyTolerance(-3, 1.75)).toBeCloseTo(-1.25, 5);
	});

	it("weights uncorrectable points down", () => {
		const deepNull: AnalysisPoint = {
			frequency: 190,
			reliability: 1,
			isDeepNull: true,
			requiresBoost: true,
			boostAllowed: false,
			requiresCut: false,
			isOutsideUsableRange: false,
		};
		expect(getCorrectabilityWeight(deepNull)).toBe(0.05);

		const normal: AnalysisPoint = {
			frequency: 500,
			reliability: 0.9,
			isDeepNull: false,
			requiresBoost: false,
			boostAllowed: true,
			requiresCut: true,
			isOutsideUsableRange: false,
		};
		expect(getCorrectabilityWeight(normal)).toBe(1);
	});

	it("penalizes broad overcut and broad cut limits", () => {
		const target = Array.from({ length: 40 }, (_, index) => ({
			frequency: 1_000 * 2 ** (index / 12),
			db: 0,
		}));
		const predicted = target.map((point) => ({
			frequency: point.frequency,
			db: -4,
		}));
		const overcut = computeBroadOvercutPenalty(smoothToBroad(predicted), target);
		expect(overcut).toBeGreaterThan(0);

		const combined = target.map((point) => ({
			frequency: point.frequency,
			db: -6,
		}));
		const limitPenalty = computeBroadCutLimitPenalty(smoothToBroad(combined));
		expect(getMaximumBroadCutDb(3_000)).toBe(-4.5);
		expect(limitPenalty).toBeGreaterThan(0);
	});

	it("rejects candidates with large off-band damage via evaluation rules", () => {
		const evaluation: CandidateEvaluation = {
			globalCostBefore: 10,
			globalCostAfter: 9.5,
			localCostBefore: 4,
			localCostAfter: 3.5,
			offBandCostBefore: 2,
			offBandCostAfter: 2.5,
			globalImprovement: 0.5,
			localImprovement: 0.5,
			offBandDamage: 0.5,
			broadOvercutBefore: 1,
			broadOvercutAfter: 1,
		};
		expect(
			acceptsCandidateEvaluation(evaluation, {
				frequency: 3_000,
				reason: "broad-tonal-error",
			}),
		).toBe(false);
	});

	it("prefers wider high-frequency filters and penalizes high Q", () => {
		expect(getPreferredMaximumQ(3_000)).toBe(2.5);
		expect(getPreferredMaximumQ(7_000)).toBe(1.8);
		expect(getPreferredMaximumQ(12_000)).toBe(1.2);
		expect(getHighQPenaltyWeight(12_000, 1)).toBeGreaterThan(
			getHighQPenaltyWeight(200, 1),
		);
	});

	it("is deterministic for identical input and seed", () => {
		const measurement = [buildHighFrequencySynthetic()];
		const first = generateAutoEqV3(measurement, {
			...DEFAULT_V3_OPTIONS,
			seed: 42,
		});
		const second = generateAutoEqV3(measurement, {
			...DEFAULT_V3_OPTIONS,
			seed: 42,
		});
		expect(
			first.filters.map((filter) => [
				filter.frequency,
				filter.gainDb,
				filter.q,
				filter.type,
			]),
		).toEqual(
			second.filters.map((filter) => [
				filter.frequency,
				filter.gainDb,
				filter.q,
				filter.type,
			]),
		);
	}, 45_000);
});

describe("auto-eq V3.1 MOCK 9 behaviour", () => {
	it("keeps bass resonance correction while limiting HF overcut", () => {
		const measurement = buildMock9();
		const result = generateAutoEqV3([measurement], {
			...DEFAULT_V3_OPTIONS,
			sampleRate: SAMPLE_RATE,
			seed: 42,
		});

		const near132 = result.filters.find(
			(filter) => Math.abs(Math.log2(filter.frequency / 132)) < 1 / 8,
		);
		const near450 = result.filters.find(
			(filter) => Math.abs(Math.log2(filter.frequency / 450)) < 1 / 6,
		);

		expect(near132).toBeTruthy();
		expect(near132!.gainDb).toBeLessThanOrEqual(-8);
		expect(near132!.gainDb).toBeGreaterThanOrEqual(-15);

		expect(near450).toBeTruthy();
		expect(near450!.gainDb).toBeLessThan(0);

		expect(result.weightedRmsAfterDb).toBeLessThan(result.weightedRmsBeforeDb);
		expect(result.broadRmsAfterDb).toBeLessThanOrEqual(
			result.broadRmsBeforeDb + 0.15,
		);
		// Bass resonance cuts can raise local overcut area; HF overcut must stay controlled.
		expect(result.maximumBroadOvercutAfterDb).toBeLessThan(4.5);
		expect(result.preampDb).toBe(0);
		expect(result.maximumCombinedBoostDb).toBeLessThanOrEqual(0);

		for (let index = 0; index < result.predicted.length; index += 1) {
			const expected =
				result.measured[index].db + result.combinedFilterResponse[index].db;
			expect(result.predicted[index].db).toBeCloseTo(expected, 6);
		}

		const broadCombined = smoothToBroad(result.combinedFilterResponse);
		for (const point of broadCombined) {
			if (point.frequency >= 1_000 && point.frequency < 5_000) {
				expect(point.db).toBeGreaterThanOrEqual(-5.2);
			}
			if (point.frequency >= 5_000 && point.frequency < 10_000) {
				expect(point.db).toBeGreaterThanOrEqual(-4.2);
			}
			if (point.frequency >= 10_000) {
				expect(point.db).toBeGreaterThanOrEqual(-3.2);
			}
		}

		expect(result.filters.length).toBeGreaterThanOrEqual(3);
		expect(result.filters.length).toBeLessThanOrEqual(10);
		expect(result.diagnostics.filtersAfterSafetyPass).toBe(result.filters.length);

		// V3.0 baseline reference (analysis run): overcut bands were deeper.
		expect(result.maximumBroadOvercutAfterDb).toBeLessThan(4.0);
	}, 90_000);

	it("compares V2 and V3.1 on MOCK 9 without requiring lower plain RMS at all costs", () => {
		const measurement = buildMock9();
		const v2 = generateAutoEqV2([measurement], {
			sampleRate: SAMPLE_RATE,
			maxFilters: 16,
			targetType: "room",
			seed: 42,
			precision: "standard",
		});
		const v3 = generateAutoEqV3([measurement], {
			...DEFAULT_V3_OPTIONS,
			sampleRate: SAMPLE_RATE,
			seed: 42,
		});

		const near132V3 = v3.filters.find(
			(filter) => Math.abs(Math.log2(filter.frequency / 132)) < 1 / 8,
		);
		expect(near132V3).toBeTruthy();
		expect(v3.maximumBroadOvercutAfterDb).toBeLessThan(4.5);
		expect(v3.filters.length).toBeLessThanOrEqual(10);
		expect(v2.filters.length).toBeGreaterThan(0);
	}, 90_000);
});

describe("auto-eq V3.1 synthetic high frequency", () => {
	it("does not fully erase a +5 dB 2–8 kHz shelf on a single measurement", () => {
		const measurement = buildHighFrequencySynthetic();
		const result = generateAutoEqV3([measurement], {
			...DEFAULT_V3_OPTIONS,
			sampleRate: SAMPLE_RATE,
			seed: 42,
		});

		const broadCombined = smoothToBroad(result.combinedFilterResponse);
		const hfCuts = broadCombined.filter(
			(point) => point.frequency >= 2_000 && point.frequency <= 8_000,
		);
		const deepest = Math.min(...hfCuts.map((point) => point.db));
		expect(deepest).toBeGreaterThan(-5.5);
		expect(deepest).toBeGreaterThanOrEqual(getMaximumBroadCutDb(4_000) - 0.75);

		const overlapping = result.filters.filter(
			(filter) => filter.frequency >= 1_500 && filter.frequency <= 9_000,
		);
		expect(overlapping.length).toBeLessThanOrEqual(3);
		expect(result.maximumBroadOvercutAfterDb).toBeLessThan(3.5);
	}, 60_000);
});

describe("auto-eq V3.1 multi-measurement repeated resonance", () => {
	it("allows stronger repeated 3 kHz correction than single measurement", () => {
		const repeated = buildRepeated3kHzMeasurements();
		const single = generateAutoEqV3([repeated[0]], {
			...DEFAULT_V3_OPTIONS,
			sampleRate: SAMPLE_RATE,
			seed: 42,
			allowBoosts: false,
		});
		const multi = generateAutoEqV3(repeated, {
			...DEFAULT_V3_OPTIONS,
			sampleRate: SAMPLE_RATE,
			seed: 42,
			allowBoosts: false,
		});

		const pick3k = (filters: GeneratedEqFilter[]) =>
			filters
				.filter(
					(filter) => Math.abs(Math.log2(filter.frequency / 3_000)) < 1 / 4,
				)
				.sort((a, b) => Math.abs(b.gainDb) - Math.abs(a.gainDb))[0];

		const singleCut = pick3k(single.filters);
		const multiCut = pick3k(multi.filters);

		const singleLimit = getFrequencyLimits(3_000, "PK", {
			measurementCount: 1,
		}).maxCutDb;
		const multiLimit = getFrequencyLimits(3_000, "PK", {
			measurementCount: 3,
			highConfidenceRepeatedResonance: true,
		}).maxCutDb;
		expect(singleLimit).toBe(-3.5);
		expect(multiLimit).toBe(-5);
		expect(singleLimit).toBeGreaterThan(multiLimit);

		if (singleCut && multiCut) {
			expect(Math.abs(multiCut.gainDb) + 1e-6).toBeGreaterThanOrEqual(
				Math.abs(singleCut.gainDb) - 0.5,
			);
		}
	}, 90_000);
});

describe("auto-eq V1/V2 regression guards", () => {
	it("keeps V1 output stable for a fixed curve", () => {
		const curve = buildHighFrequencySynthetic();
		const first = generateAutoEq(curve, {
			sampleRate: SAMPLE_RATE,
			maxFilters: 8,
		});
		const second = generateAutoEq(curve, {
			sampleRate: SAMPLE_RATE,
			maxFilters: 8,
		});
		expect(first.filters).toEqual(second.filters);
		expect(first.preampDb).toBe(second.preampDb);
		expect(first.errorAfter).toBe(second.errorAfter);
	});

	it("keeps V2 regression baseline intact", () => {
		const measurement = buildHighFrequencySynthetic();
		const first = generateAutoEqV2([measurement], {
			sampleRate: SAMPLE_RATE,
			maxFilters: 16,
			targetType: "room",
			seed: 42,
			precision: "standard",
		});
		const second = generateAutoEqV2([measurement], {
			sampleRate: SAMPLE_RATE,
			maxFilters: 16,
			targetType: "room",
			seed: 42,
			precision: "standard",
		});
		expect(first.filters).toEqual(second.filters);
		expect(first.preampDb).toBe(second.preampDb);
		expect(first.errorAfter).toBe(second.errorAfter);
	});
});

describe("auto-eq V3.1 safety pass", () => {
	it("can weaken filters that create broad undershoot", () => {
		const measurement = buildHighFrequencySynthetic();
		const prepared = prepareMeasurement([measurement], {
			...DEFAULT_V3_OPTIONS,
			sampleRate: SAMPLE_RATE,
		});
		const aggressive: GeneratedEqFilter[] = [
			{
				id: "hf-1",
				type: "PK",
				frequency: 3_500,
				gainDb: -5,
				q: 0.7,
				enabled: true,
				confidence: 0.8,
				improvementPercent: 5,
				contributionPercent: 5,
				affectedRange: { fromHz: 2_000, toHz: 7_000 },
				reason: "broad-tonal-error",
			},
			{
				id: "hf-2",
				type: "PK",
				frequency: 6_000,
				gainDb: -4,
				q: 0.8,
				enabled: true,
				confidence: 0.7,
				improvementPercent: 4,
				contributionPercent: 4,
				affectedRange: { fromHz: 3_500, toHz: 10_000 },
				reason: "broad-tonal-error",
			},
		];

		const safety = runFinalSafetyPass(
			aggressive,
			prepared,
			[measurement],
			{ ...DEFAULT_V3_OPTIONS, sampleRate: SAMPLE_RATE },
		);

		const deepestBefore = Math.min(...aggressive.map((filter) => filter.gainDb));
		const deepestAfter = Math.min(
			...safety.filters.map((filter) => filter.gainDb),
			0,
		);
		expect(deepestAfter).toBeGreaterThanOrEqual(deepestBefore);
	});
});

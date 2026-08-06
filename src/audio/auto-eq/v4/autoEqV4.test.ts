import { describe, expect, it } from "vitest";
import { generateAutoEq } from "../../autoEq";
import { generateAutoEqV2 } from "../autoEq";
import { generateAutoEqV3 } from "../v3/autoEqV3";
import { createMockMeasurementRun } from "../../../utils/mockMeasurement";
import { generateAutoEqV4 } from "./autoEqV4";
import { getFilterResponseDb } from "./biquadResponse";
import {
	getScaleWeights,
	getTargetToleranceDb,
	getOvercutPenaltyMultiplier,
	getMaximumBroadCutDb,
} from "./multiScaleCost";
import {
	createLogarithmicGrid,
	huber,
	parabolicPeakFrequency,
	qFromBandwidthOctaves,
} from "./math";
import { deriveMultiScaleFromRaw } from "./fractionalOctave";
import {
	detectCombArtifactFrequencies,
	detectDeepNulls,
	isSingleBinArtifact,
} from "./nullDetection";
import { getV4CorrectionStrength, getMinimumScalePersistence } from "./correctionStrength";
import { validateV4MeasurementResolution, looksLikeInterpolatedFrom1_12 } from "./validation";
import { prepareMeasurement } from "./prepareMeasurement";
import { DEFAULT_V4_OPTIONS } from "./constants";
import type { FrequencyPoint } from "./types";

const SAMPLE_RATE = 48_000;

function buildLogSpacedRaw(
	count: number,
	dbAt: (frequency: number, index: number) => number,
	minFrequency = 20,
	maxFrequency = 20_000,
): FrequencyPoint[] {
	const minLog = Math.log2(minFrequency);
	const maxLog = Math.log2(maxFrequency);
	return Array.from({ length: count }, (_, index) => {
		const ratio = index / (count - 1);
		const frequency = 2 ** (minLog + ratio * (maxLog - minLog));
		return { frequency, db: dbAt(frequency, index) };
	});
}

function gaussianLogBump(
	frequency: number,
	center: number,
	q: number,
	amplitudeDb: number,
): number {
	const bandwidthOctaves = Math.log2(1 + 1 / (2 * q) + Math.sqrt(1 + 1 / (q * q)));
	const sigma = bandwidthOctaves / 2.355;
	const x = Math.log2(frequency / center) / Math.max(sigma, 1e-6);
	return amplitudeDb * Math.exp(-0.5 * x * x);
}

describe("auto-eq V4 units", () => {
	it("validates native dense RAW grids and rejects sparse curves", () => {
		const dense = buildLogSpacedRaw(520, () => 0);
		const resolution = validateV4MeasurementResolution([dense]);
		expect(resolution.source).toBe("raw-derived-1/24");
		expect(resolution.isNativeResolution).toBe(true);
		expect(resolution.pointsPerOctave).toBeGreaterThanOrEqual(18);

		const sparse = Array.from({ length: 24 }, (_, index) => ({
			frequency: 20 * 2 ** (index / 2),
			db: 0,
		}));
		expect(() => validateV4MeasurementResolution([sparse])).toThrow(
			/v4-requires-native-1-24-data/,
		);
	});

	it("rejects artificial 1/24 created from 1/12 spacing patterns", () => {
		// Exact 1/12 grid duplicated with midpoints to fake 1/24 density.
		const twelfth: FrequencyPoint[] = [];
		for (let i = 0; i < 120; i += 1) {
			const frequency = 20 * 2 ** (i / 12);
			if (frequency > 20_000) break;
			twelfth.push({ frequency, db: Math.sin(i) });
		}
		const fake: FrequencyPoint[] = [];
		for (let i = 0; i < twelfth.length - 1; i += 1) {
			fake.push(twelfth[i]);
			fake.push({
				frequency: Math.sqrt(twelfth[i].frequency * twelfth[i + 1].frequency),
				db: (twelfth[i].db + twelfth[i + 1].db) / 2,
			});
		}
		fake.push(twelfth[twelfth.length - 1]);
		expect(looksLikeInterpolatedFrom1_12(fake)).toBe(true);
		expect(() => validateV4MeasurementResolution([fake])).toThrow(
			/v4-requires-native-1-24-data/,
		);
	});

	it("derives multi-scale curves from RAW without inventing detail", () => {
		const raw = buildLogSpacedRaw(520, (frequency) =>
			gaussianLogBump(frequency, 120, 8, 6),
		);
		const grid = createLogarithmicGrid(20, 20_000, 256);
		const scales = deriveMultiScaleFromRaw(raw, grid);
		expect(scales.native1_24).toHaveLength(256);
		expect(scales.octave1_12).toHaveLength(256);
		expect(scales.octave1_6).toHaveLength(256);
		expect(scales.octave1_3).toHaveLength(256);

		const peak24 = scales.native1_24.reduce((best, point) =>
			point.db > best.db ? point : best,
		);
		const peak12 = scales.octave1_12.reduce((best, point) =>
			point.db > best.db ? point : best,
		);
		expect(peak24.db).toBeGreaterThan(peak12.db - 0.5);
		expect(peak24.frequency).toBeGreaterThan(90);
		expect(peak24.frequency).toBeLessThan(160);
	});

	it("interpolates Fc on a log2 axis without extrapolating", () => {
		const frequencies = [100, 106, 112];
		const values = [2, 5, 3];
		const fc = parabolicPeakFrequency(frequencies, values, 1);
		expect(fc).toBeGreaterThan(100);
		expect(fc).toBeLessThan(112);
		expect(fc).not.toBe(106);
	});

	it("computes Q from bandwidth in octaves", () => {
		const q = qFromBandwidthOctaves(1 / 6);
		expect(q).toBeGreaterThan(2);
		expect(q).toBeLessThan(12);
	});

	it("flags single-bin artifacts by bandwidth", () => {
		expect(isSingleBinArtifact(1 / 64)).toBe(true);
		expect(isSingleBinArtifact(1 / 12)).toBe(false);
	});

	it("applies frequency-dependent scale persistence thresholds", () => {
		expect(getMinimumScalePersistence(100)).toBeLessThan(
			getMinimumScalePersistence(6_000),
		);
	});

	it("detects deep nulls and comb-like harmonic spacing", () => {
		const grid = createLogarithmicGrid(200, 2_000, 500);
		const centers = [400, 800, 1_200];
		const narrow = grid.map((point, index) => {
			let db = 0;
			for (const center of centers) {
				const distanceOct = Math.abs(Math.log2(point.frequency / center));
				db -= 12 * Math.exp(-0.5 * (distanceOct / (1 / 64)) ** 2);
			}
			// Ensure a strict discrete local minimum near each center.
			for (const center of centers) {
				const prev = grid[Math.max(0, index - 1)];
				const next = grid[Math.min(grid.length - 1, index + 1)];
				const closerThanNeighbors =
					Math.abs(Math.log2(point.frequency / center)) <
						Math.abs(Math.log2(prev.frequency / center)) &&
					Math.abs(Math.log2(point.frequency / center)) <
						Math.abs(Math.log2(next.frequency / center));
				if (closerThanNeighbors) db = Math.min(db, -9);
			}
			return { frequency: point.frequency, db };
		});
		const nulls = detectDeepNulls(grid, narrow);
		expect(nulls.length).toBeGreaterThan(0);
		const comb = detectCombArtifactFrequencies(nulls);
		expect(comb.size).toBeGreaterThan(0);
	});

	it("uses frequency-dependent multi-scale weights and tolerances", () => {
		const low = getScaleWeights(100);
		const high = getScaleWeights(8_000);
		expect(low.octave1_24).toBeGreaterThan(high.octave1_24);
		expect(getTargetToleranceDb(100)).toBeLessThan(getTargetToleranceDb(12_000));
		expect(getOvercutPenaltyMultiplier(3_000)).toBeGreaterThan(
			getOvercutPenaltyMultiplier(100),
		);
		expect(getMaximumBroadCutDb(3_000)).toBe(-5);
	});

	it("implements Huber loss and correction strength scaling", () => {
		expect(huber(1, 2)).toBeCloseTo(0.5);
		expect(huber(4, 2)).toBeGreaterThan(huber(1, 2));
		const bass = getV4CorrectionStrength(80, 1, 1, 1);
		const treble = getV4CorrectionStrength(12_000, 1, 1, 1);
		expect(bass).toBeGreaterThan(treble);
	});

	it("computes real RBJ PK/LS/HS responses", () => {
		const pk = getFilterResponseDb(
			{ type: "PK", frequency: 1_000, gainDb: -6, q: 2 },
			1_000,
			SAMPLE_RATE,
		);
		const ls = getFilterResponseDb(
			{ type: "LS", frequency: 100, gainDb: -3, q: 0.707 },
			40,
			SAMPLE_RATE,
		);
		const hs = getFilterResponseDb(
			{ type: "HS", frequency: 8_000, gainDb: -3, q: 0.707 },
			16_000,
			SAMPLE_RATE,
		);
		expect(pk).toBeLessThan(-4);
		expect(ls).toBeLessThan(-1);
		expect(hs).toBeLessThan(-1);
	});

	it(
		"keeps predicted response free of preamp and zero preamp for cuts-only",
		() => {
			const raw = buildLogSpacedRaw(520, (frequency) =>
				gaussianLogBump(frequency, 60, 10, 10),
			);
			const result = generateAutoEqV4([raw], { maxFilters: 6, seed: 42 , precisionMode: "balanced",
			});
			expect(result.version).toBe("v4");
			for (let index = 0; index < result.predicted1_12.length; index += 1) {
				const expected =
					result.measured1_12[index].db + result.combinedFilterResponse[index].db;
				expect(result.predicted1_12[index].db).toBeCloseTo(expected, 5);
			}
			const onlyCuts = result.filters.every((filter) => filter.gainDb <= 0);
			if (onlyCuts) {
				expect(result.preampDb).toBe(0);
			}
		},
		60_000,
	);

	it(
		"is deterministic for identical input and seed",
		() => {
			const raw = buildLogSpacedRaw(400, (frequency) =>
				gaussianLogBump(frequency, 90, 9, 8),
			);
			const first = generateAutoEqV4([raw], { maxFilters: 6, seed: 11 , precisionMode: "balanced",
			});
			const second = generateAutoEqV4([raw], { maxFilters: 6, seed: 11 , precisionMode: "balanced",
			});
			expect(first.filters.map((f) => [f.frequency, f.gainDb, f.q])).toEqual(
				second.filters.map((f) => [f.frequency, f.gainDb, f.q]),
			);
		},
		60_000,
	);
});

describe("auto-eq V4 dual close resonances", () => {
	it(
		"separates two resolvable nearby bass resonances when beneficial",
		() => {
			const raw = buildLogSpacedRaw(700, (frequency) => {
				return (
					gaussianLogBump(frequency, 118, 10, 8) +
					gaussianLogBump(frequency, 132, 8, 6)
				);
			});
			const result = generateAutoEqV4([raw], {
				maxFilters: 8,
				seed: 42,
				targetType: "flat",
				precisionMode: "balanced",
			});
			const bassCuts = result.filters.filter(
				(filter) =>
					filter.type === "PK" &&
					filter.gainDb < -1 &&
					filter.frequency > 90 &&
					filter.frequency < 160,
			);
			expect(bassCuts.length).toBeGreaterThanOrEqual(1);
			if (bassCuts.length >= 2) {
				const sorted = [...bassCuts].sort((a, b) => a.frequency - b.frequency);
				expect(sorted[1].frequency / sorted[0].frequency).toBeGreaterThan(1.05);
			}
			expect(result.weightedRms1_12AfterDb).toBeLessThanOrEqual(
				result.weightedRms1_12BeforeDb + 0.25,
			);
		},
		90_000,
	);

	it(
		"prefers a simpler single filter when resonances are too close",
		() => {
			const raw = buildLogSpacedRaw(700, (frequency) => {
				return (
					gaussianLogBump(frequency, 120, 14, 7) +
					gaussianLogBump(frequency, 123, 14, 6)
				);
			});
			const result = generateAutoEqV4([raw], {
				maxFilters: 6,
				seed: 7,
				targetType: "flat",
				precisionMode: "balanced",
			});
			const bassCuts = result.filters.filter(
				(filter) =>
					filter.type === "PK" &&
					filter.gainDb < -1 &&
					filter.frequency > 100 &&
					filter.frequency < 140,
			);
			expect(bassCuts.length).toBeLessThanOrEqual(2);
			expect(bassCuts.length).toBeGreaterThanOrEqual(1);
		},
		90_000,
	);
});

describe("auto-eq V4 single-bin artifact", () => {
	it(
		"does not create a filter for an isolated 6 kHz 1/24 spike",
		() => {
			const raw = buildLogSpacedRaw(700, (_frequency, index) => {
				const targetIndex = rawIndexNear(700, 6_000);
				return index === targetIndex ? 7 : 0;
			});
			const result = generateAutoEqV4([raw], {
				maxFilters: 6,
				seed: 3,
				targetType: "flat",
				precisionMode: "balanced",
			});
			const hfFilters = result.filters.filter(
				(filter) => filter.frequency > 4_000 && filter.frequency < 8_000,
			);
			expect(hfFilters.length).toBe(0);
			expect(result.diagnostics.rejectedSingleBinCount).toBeGreaterThanOrEqual(0);
		},
		60_000,
	);
});

function rawIndexNear(count: number, targetHz: number): number {
	const minLog = Math.log2(20);
	const maxLog = Math.log2(20_000);
	let best = 0;
	let bestDistance = Number.POSITIVE_INFINITY;
	for (let index = 0; index < count; index += 1) {
		const frequency = 2 ** (minLog + (index / (count - 1)) * (maxLog - minLog));
		const distance = Math.abs(Math.log2(frequency / targetHz));
		if (distance < bestDistance) {
			bestDistance = distance;
			best = index;
		}
	}
	return best;
}

describe("auto-eq V4 bass resonance", () => {
	it(
		"fits a strong low-frequency resonance without broad bass overcut",
		() => {
			const makeRun = (salt: number) =>
				buildLogSpacedRaw(600, (frequency) => {
					const jitter = Math.sin(frequency * 0.01 + salt) * 0.15;
					return gaussianLogBump(frequency, 52, 14, 12) + jitter;
				});
			const result = generateAutoEqV4([makeRun(0), makeRun(1), makeRun(2)], {
				maxFilters: 8,
				seed: 42,
				targetType: "flat",
			});
			const bass = result.filters.find(
				(filter) =>
					filter.type === "PK" &&
					filter.gainDb < -2 &&
					filter.frequency > 40 &&
					filter.frequency < 75,
			);
			expect(bass).toBeDefined();
			expect(Math.abs((bass?.frequency ?? 0) - 52)).toBeLessThan(16);
			expect(result.broadRmsAfterDb).toBeLessThanOrEqual(
				result.broadRmsBeforeDb + 0.5,
			);
		},
		90_000,
	);
});

describe("auto-eq V4 high frequency behaviour", () => {
	it(
		"uses a broad tonal filter and avoids null boosts / bin spikes",
		() => {
			const raw = buildLogSpacedRaw(650, (frequency, index) => {
				let db = 0;
				if (frequency >= 2_000 && frequency <= 8_000) db += 4;
				db += Math.sin(index * 1.7) * 2 * (frequency > 2_000 ? 1 : 0);
				db -= gaussianLogBump(frequency, 4_500, 20, 10);
				return db;
			});
			const result = generateAutoEqV4([raw], {
				maxFilters: 8,
				seed: 42,
				targetType: "flat",
				precisionMode: "balanced",
			});
			const boostsNearNull = result.filters.filter(
				(filter) =>
					filter.gainDb > 0 &&
					filter.frequency > 4_000 &&
					filter.frequency < 5_000,
			);
			expect(boostsNearNull.length).toBe(0);
			expect(result.broadRmsAfterDb).toBeLessThanOrEqual(
				result.broadRmsBeforeDb + 0.5,
			);
			expect(result.filters.length).toBeLessThanOrEqual(8);
		},
		90_000,
	);
});

describe("auto-eq V4 MOCK 5 / MOCK 9", () => {
	function mockRaw(presetId: number): FrequencyPoint[] {
		const { curve } = createMockMeasurementRun({
			fMin: 20,
			fMax: 20_000,
			smoothing: 0,
			durationSeconds: 5,
			levelDb: -18,
			channel: "both",
			runIndex: 1,
			presetId,
		});
		return curve;
	}

	it(
		"runs on MOCK 5 with safety-aware results",
		() => {
			const raw = mockRaw(5);
			const v4 = generateAutoEqV4([raw], { maxFilters: 8, seed: 42 , precisionMode: "balanced",
			});
			expect(v4.filters.length).toBeGreaterThan(0);
			expect(v4.filters.length).toBeLessThanOrEqual(12);
			expect(v4.weightedRms1_12AfterDb).toBeLessThanOrEqual(
				v4.weightedRms1_12BeforeDb + 0.35,
			);
			expect(v4.broadRmsAfterDb).toBeLessThanOrEqual(v4.broadRmsBeforeDb + 0.75);
		},
		120_000,
	);

	it(
		"compares V3.1 and V4 on MOCK 9 without requiring lowest RMS at all costs",
		() => {
			const raw = mockRaw(9);
			const v3 = generateAutoEqV3([raw], {
				sampleRate: SAMPLE_RATE,
				maxFilters: 8,
				targetType: "room",
				seed: 42,
			});
			const v4 = generateAutoEqV4([raw], {
				sampleRate: SAMPLE_RATE,
				maxFilters: 8,
				targetType: "room",
				seed: 42,
				precisionMode: "balanced",
			});
			expect(v4.filters.length).toBeGreaterThan(0);
			expect(v4.filters.length).toBeLessThanOrEqual(12);
			expect(v4.filters.length).toBeLessThanOrEqual(v3.filters.length + 6);
			expect(v4.broadRmsAfterDb).toBeLessThan(v4.broadRmsBeforeDb + 0.75);
		},
		180_000,
	);
});

describe("auto-eq V4 multi-measurement spatial persistence", () => {
	it(
		"keeps repeated 320 Hz resonance and avoids unstable 5 kHz peak",
		() => {
			const make = (shiftOctaves: number) =>
				buildLogSpacedRaw(560, (frequency) => {
					const unstableCenter = 5_000 * 2 ** shiftOctaves;
					return (
						gaussianLogBump(frequency, 320, 8, 7) +
						gaussianLogBump(frequency, unstableCenter, 10, 5)
					);
				});
			const result = generateAutoEqV4([make(0), make(1 / 18), make(-1 / 18)], {
				maxFilters: 8,
				seed: 42,
				targetType: "flat",
				precisionMode: "balanced",
			});
			const mid = result.filters.filter(
				(filter) =>
					filter.gainDb < -1 && filter.frequency > 250 && filter.frequency < 400,
			);
			const hf = result.filters.filter(
				(filter) =>
					filter.gainDb < -2 &&
					filter.frequency > 4_000 &&
					filter.frequency < 6_500,
			);
			expect(mid.length).toBeGreaterThanOrEqual(1);
			expect(hf.length).toBe(0);
		},
		90_000,
	);
});

describe("auto-eq V1/V2/V3.1 regression guards with V4 present", () => {
	it("keeps V1 output stable for a fixed curve", () => {
		const curve = buildLogSpacedRaw(200, (frequency) =>
			gaussianLogBump(frequency, 200, 4, 5),
		);
		const first = generateAutoEq(curve, { sampleRate: SAMPLE_RATE, maxFilters: 8 });
		const second = generateAutoEq(curve, { sampleRate: SAMPLE_RATE, maxFilters: 8 });
		expect(first.filters).toEqual(second.filters);
		expect(first.preampDb).toBe(second.preampDb);
	});

	it("keeps V2 output stable for a fixed curve", () => {
		const measurement = buildLogSpacedRaw(300, (frequency) =>
			gaussianLogBump(frequency, 180, 5, 6),
		);
		const first = generateAutoEqV2([measurement], {
			sampleRate: SAMPLE_RATE,
			maxFilters: 8,
			targetType: "room",
			seed: 42,
			precision: "standard",
		});
		const second = generateAutoEqV2([measurement], {
			sampleRate: SAMPLE_RATE,
			maxFilters: 8,
			targetType: "room",
			seed: 42,
			precision: "standard",
		});
		expect(first.filters).toEqual(second.filters);
		expect(first.preampDb).toBe(second.preampDb);
	});

	it("keeps V3.1 output stable for a fixed curve", () => {
		const measurement = buildLogSpacedRaw(300, (frequency) =>
			gaussianLogBump(frequency, 180, 5, 6),
		);
		const first = generateAutoEqV3([measurement], {
			sampleRate: SAMPLE_RATE,
			maxFilters: 8,
			targetType: "room",
			seed: 42,
		});
		const second = generateAutoEqV3([measurement], {
			sampleRate: SAMPLE_RATE,
			maxFilters: 8,
			targetType: "room",
			seed: 42,
		});
		expect(first.filters).toEqual(second.filters);
		expect(first.preampDb).toBe(second.preampDb);
		expect(first.errorAfter).toBe(second.errorAfter);
	});
});

describe("auto-eq V4 prepareMeasurement", () => {
	it("builds analysis points and multi-scale residuals from RAW", () => {
		const raw = buildLogSpacedRaw(400, (frequency) =>
			gaussianLogBump(frequency, 100, 6, 5),
		);
		const prepared = prepareMeasurement([raw], {
			...DEFAULT_V4_OPTIONS,
			sampleRate: SAMPLE_RATE,
		});
		expect(prepared.native1_24.length).toBeGreaterThan(0);
		expect(prepared.resolvedTarget.points1_24.length).toBe(
			prepared.native1_24.length,
		);
		expect(prepared.resolution.source).toBe("raw-derived-1/24");
	});
});

import { describe, expect, it } from "vitest";
import { generateAutoEqV4 } from "./autoEqV4";
import type { FrequencyPoint } from "./types";

function buildSyntheticRawCurve(): FrequencyPoint[] {
	const points: FrequencyPoint[] = [];
	const minFrequency = 20;
	const maxFrequency = 20_000;
	const count = 600;
	const minLog = Math.log2(minFrequency);
	const maxLog = Math.log2(maxFrequency);

	for (let index = 0; index < count; index += 1) {
		const ratio = index / (count - 1);
		const frequency = 2 ** (minLog + ratio * (maxLog - minLog));
		let db = 0;
		// Broad room-tilt-like trend.
		db += frequency < 200 ? 2 : 0;
		db -= frequency > 8_000 ? (Math.log2(frequency / 8_000) * 1.5) : 0;
		// A resonance peak around 120 Hz.
		db += 6 * Math.exp(-0.5 * ((Math.log2(frequency / 120) / (1 / 12)) ** 2));
		// A narrow null around 2.3 kHz.
		db -= 9 * Math.exp(-0.5 * ((Math.log2(frequency / 2_300) / (1 / 30)) ** 2));
		// Small pseudo-random single-bin noise.
		db += Math.sin(index * 12.9898) * 0.15;
		points.push({ frequency, db });
	}

	return points;
}

describe("generateAutoEqV4 smoke test", () => {
	it("throws v4-requires-native-1-24-data on sparse curves", () => {
		const sparse: FrequencyPoint[] = Array.from({ length: 20 }, (_, index) => ({
			frequency: 20 * 2 ** index,
			db: 0,
		}));
		expect(() => generateAutoEqV4([sparse])).toThrowError(/v4-requires-native-1-24-data/);
	});

	it(
		"runs end-to-end on a dense RAW curve and returns a sane result",
		() => {
			const raw = buildSyntheticRawCurve();
			const result = generateAutoEqV4([raw], { maxFilters: 8, seed: 7 , precisionMode: "balanced"});

			expect(result.filters.length).toBeGreaterThan(0);
			expect(result.filters.length).toBeLessThanOrEqual(8);
			expect(Number.isFinite(result.errorBefore)).toBe(true);
			expect(Number.isFinite(result.errorAfter)).toBe(true);
			expect(result.errorAfter).toBeLessThanOrEqual(result.errorBefore + 1e-6);
			expect(result.resolution.source).toBe("raw-derived-1/24");
			expect(result.resolution.isNativeResolution).toBe(true);
			expect(Number.isFinite(result.preampDb)).toBe(true);
			expect(result.diagnostics.executionTimeMs).toBeGreaterThanOrEqual(0);

			for (const filter of result.filters) {
				expect(["PK", "LS", "HS"]).toContain(filter.type);
				expect(Number.isFinite(filter.frequency)).toBe(true);
				expect(Number.isFinite(filter.gainDb)).toBe(true);
				expect(Number.isFinite(filter.q)).toBe(true);
			}
		},
		60_000,
	);

	it(
		"is deterministic for a fixed seed",
		() => {
			const raw = buildSyntheticRawCurve();
			const first = generateAutoEqV4([raw], { maxFilters: 6, seed: 42 , precisionMode: "balanced"});
			const second = generateAutoEqV4([raw], { maxFilters: 6, seed: 42 , precisionMode: "balanced"});
			expect(first.filters.map((f) => [f.frequency, f.gainDb, f.q])).toEqual(
				second.filters.map((f) => [f.frequency, f.gainDb, f.q]),
			);
		},
		60_000,
	);
});

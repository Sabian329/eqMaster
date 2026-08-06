import { getV4SearchBudget } from "./constants";
import { cloneV4Filter } from "./candidateGeneration";
import { clampFilterGain, clampFilterQ } from "./frequencyLimits";
import { SeededRandom } from "./math";
import type {
	PreparedV4Measurement,
	V4GeneratedFilter,
	V4PrecisionMode,
} from "./types";

/**
 * Builds deterministic variants of the beam-search result: the identity start
 * plus small, seed-derived jitters in frequency, Q and gain. Count depends on
 * precisionMode. Each is independently refined by the global optimizer.
 */
export function buildV4MultiStartVariants(
	initialFilters: V4GeneratedFilter[],
	seed: number,
	prepared: PreparedV4Measurement,
	precisionMode: V4PrecisionMode = "maximum",
): V4GeneratedFilter[][] {
	const random = new SeededRandom(seed);
	const limitOptions = { measurementCount: prepared.measurementCount };
	const multiStartCount = getV4SearchBudget(precisionMode).multiStartCount;

	const identity = initialFilters.map(cloneV4Filter);

	const frequencyJitter = initialFilters.map((filter) => {
		const clone = cloneV4Filter(filter);
		clone.frequency *= 2 ** (1 / 48);
		clone.gainDb = clampFilterGain(clone.gainDb, clone.frequency, clone.type, limitOptions);
		return clone;
	});

	const qJitter = initialFilters.map((filter) => {
		const clone = cloneV4Filter(filter);
		clone.q = clampFilterQ(clone.q * 1.15, clone.frequency, clone.gainDb, clone.type, false, limitOptions);
		return clone;
	});

	const gainAndFrequencyJitter = initialFilters.map((filter) => {
		const clone = cloneV4Filter(filter);
		const jitter = (random.next() - 0.5) / 24;
		clone.frequency *= 2 ** jitter;
		clone.gainDb = clampFilterGain(clone.gainDb * 0.92, clone.frequency, clone.type, limitOptions);
		return clone;
	});

	return [identity, frequencyJitter, qJitter, gainAndFrequencyJitter].slice(
		0,
		multiStartCount,
	);
}

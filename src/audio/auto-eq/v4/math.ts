import type { FrequencyPoint } from "./types";

export const clamp = (value: number, min: number, max: number): number =>
	Math.min(max, Math.max(min, value));

export const huber = (error: number, delta = 2): number => {
	const absolute = Math.abs(error);
	if (absolute <= delta) return 0.5 * error * error;
	return delta * (absolute - 0.5 * delta);
};

export const median = (values: number[]): number => {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 0) {
		return (sorted[middle - 1] + sorted[middle]) / 2;
	}
	return sorted[middle];
};

export const medianAbsoluteDeviation = (values: number[]): number => {
	if (values.length === 0) return 0;
	const med = median(values);
	return median(values.map((value) => Math.abs(value - med)));
};

export const rms = (values: number[]): number => {
	if (values.length === 0) return 0;
	const sum = values.reduce((acc, value) => acc + value * value, 0);
	return Math.sqrt(sum / values.length);
};

export class SeededRandom {
	private state: number;

	constructor(seed: number) {
		this.state = seed >>> 0;
	}

	next(): number {
		this.state = (this.state * 1_664_525 + 1_013_904_223) >>> 0;
		return this.state / 4_294_967_296;
	}

	shuffle<T>(items: T[]): T[] {
		const copy = [...items];
		for (let index = copy.length - 1; index > 0; index -= 1) {
			const swapIndex = Math.floor(this.next() * (index + 1));
			[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
		}
		return copy;
	}
}

export function seededRandom(seed: number): () => number {
	const generator = new SeededRandom(seed);
	return () => generator.next();
}

export function shuffle<T>(items: T[], seed: number): T[] {
	return new SeededRandom(seed).shuffle(items);
}

export const interpolateLogarithmically = (
	points: FrequencyPoint[],
	frequency: number,
): number => {
	if (points.length === 0) return 0;
	if (frequency <= points[0].frequency) return points[0].db;
	const last = points[points.length - 1];
	if (frequency >= last.frequency) return last.db;

	let low = 0;
	let high = points.length - 1;
	while (high - low > 1) {
		const middle = Math.floor((low + high) / 2);
		if (points[middle].frequency <= frequency) low = middle;
		else high = middle;
	}

	const left = points[low];
	const right = points[high];
	const logFrequency = Math.log2(frequency);
	const logLeft = Math.log2(left.frequency);
	const logRight = Math.log2(right.frequency);
	const ratio = (logFrequency - logLeft) / (logRight - logLeft);
	return left.db + ratio * (right.db - left.db);
};

export const createLogarithmicGrid = (
	minFrequency: number,
	maxFrequency: number,
	count: number,
): FrequencyPoint[] => {
	const minLog = Math.log2(minFrequency);
	const maxLog = Math.log2(maxFrequency);
	return Array.from({ length: count }, (_, index) => {
		const ratio = count <= 1 ? 0 : index / (count - 1);
		const frequency = 2 ** (minLog + ratio * (maxLog - minLog));
		return { frequency, db: 0 };
	});
};

export const resampleToGrid = (
	points: FrequencyPoint[],
	grid: FrequencyPoint[],
): FrequencyPoint[] =>
	grid.map((point) => ({
		frequency: point.frequency,
		db: interpolateLogarithmically(points, point.frequency),
	}));

export const qFromBandwidthOctaves = (bandwidthOctaves: number): number => {
	const safeBandwidth = Math.max(bandwidthOctaves, 1 / 48);
	const ratio = 2 ** safeBandwidth;
	return Math.sqrt(ratio) / Math.max(ratio - 1, 1e-6);
};

export const bandwidthOctavesFromQ = (q: number): number => {
	const safeQ = Math.max(q, 0.1);
	return Math.log2(1 + 1 / (2 * safeQ) + Math.sqrt(1 + 1 / (safeQ * safeQ)));
};

export const frequencyWeight = (frequency: number): number => {
	if (frequency < 80) return 1.15;
	if (frequency < 500) return 1.4;
	if (frequency < 1_000) return 1.15;
	if (frequency < 5_000) return 0.9;
	return 0.75;
};

/**
 * Expands outward from `centerIndex` while `values` stays same-signed and at
 * least `halfHeight` in magnitude, returning the half-height bounds used to
 * estimate a peak/null bandwidth.
 */
export function findHalfHeightBounds(
	values: number[],
	frequencies: number[],
	centerIndex: number,
	halfHeight: number,
): { lowerFrequency: number; upperFrequency: number; lowerIndex: number; upperIndex: number } {
	const sign = Math.sign(values[centerIndex]);
	let left = centerIndex;
	let right = centerIndex;

	while (
		left > 0 &&
		Math.sign(values[left - 1]) === sign &&
		Math.abs(values[left - 1]) >= halfHeight
	) {
		left -= 1;
	}

	while (
		right < values.length - 1 &&
		Math.sign(values[right + 1]) === sign &&
		Math.abs(values[right + 1]) >= halfHeight
	) {
		right += 1;
	}

	return {
		lowerFrequency: frequencies[left],
		upperFrequency: frequencies[right],
		lowerIndex: left,
		upperIndex: right,
	};
}

/**
 * Parabolic (vertex) interpolation of a discrete peak/trough on a uniform
 * log2(frequency) axis, returning a sub-bin-accurate center frequency.
 */
export function parabolicPeakFrequency(
	frequencies: Float64Array | number[],
	values: Float64Array | number[],
	centerIndex: number,
): number {
	const centerFrequency = frequencies[centerIndex];
	if (centerIndex <= 0 || centerIndex >= values.length - 1) {
		return centerFrequency;
	}

	const yMinus = values[centerIndex - 1];
	const yZero = values[centerIndex];
	const yPlus = values[centerIndex + 1];
	const denominator = yMinus - 2 * yZero + yPlus;
	if (Math.abs(denominator) < 1e-9) return centerFrequency;

	const offset = clamp(0.5 * (yMinus - yPlus) / denominator, -0.5, 0.5);
	const logLeft = Math.log2(frequencies[centerIndex - 1]);
	const logCenter = Math.log2(centerFrequency);
	const logRight = Math.log2(frequencies[centerIndex + 1]);
	const step = ((logRight - logLeft) / 2) || 0;
	return 2 ** (logCenter + offset * step);
}

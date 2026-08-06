import type { ChannelMode } from "../types";

/** Fixed digital sweep amplitude — not exposed in the UI. */
export const SWEEP_LEVEL_DB = -20;

export type MeasurementPresetId = "room" | "studio" | "car";

export interface MeasurementPreset {
	id: MeasurementPresetId;
	name: string;
	tagline: string;
	description: string;
	accent: string;
	channel: ChannelMode;
	fStart: number;
	fEnd: number;
	duration: number;
	smoothing: number;
	level: number;
}

export const MEASUREMENT_PRESETS: MeasurementPreset[] = [
	{
		id: "room",
		name: "Room",
		tagline: "Room acoustics",
		description:
			"Balanced 40 Hz–20 kHz range, 1/12 octave smoothing, and a 10 s sweep — a good starting point for listening-room correction.",
		accent: "#65a9ff",
		channel: "both",
		fStart: 40,
		fEnd: 20000,
		duration: 10,
		smoothing: 12,
		level: SWEEP_LEVEL_DB,
	},
	{
		id: "studio",
		name: "Studio",
		tagline: "Reference monitors",
		description:
			"Longer measurement and finer 1/24 octave smoothing for a more detailed studio monitor response.",
		accent: "#55d68b",
		channel: "both",
		fStart: 20,
		fEnd: 20000,
		duration: 15,
		smoothing: 24,
		level: SWEEP_LEVEL_DB,
	},
	{
		id: "car",
		name: "Car Audio",
		tagline: "In-car system",
		description:
			"Limited high-frequency range and wider smoothing — better in a loud, reverberant car interior.",
		accent: "#ffbf5a",
		channel: "both",
		fStart: 20,
		fEnd: 16000,
		duration: 10,
		smoothing: 6,
		level: SWEEP_LEVEL_DB,
	},
];

export function getMeasurementPreset(
	id: MeasurementPresetId,
): MeasurementPreset {
	return MEASUREMENT_PRESETS.find((p) => p.id === id)!;
}

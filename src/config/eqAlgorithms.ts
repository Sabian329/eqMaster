export type EqAlgorithmVersion = "v1" | "v2" | "v3";

export interface EqAlgorithmInfo {
	id: EqAlgorithmVersion;
	label: string;
	description: string;
}

export const EQ_ALGORITHMS: EqAlgorithmInfo[] = [
	{
		id: "v1",
		label: "V1.0.0",
		description:
			"Pro (thick) — RBJ iterative fit, flat target, narrow cuts / wide boosts.",
	},
	{
		id: "v2",
		label: "V2.0.0",
		description:
			"Precise Auto EQ — resonance detection, room target, global optimization (20 Hz–20 kHz).",
	},
	{
		id: "v3",
		label: "V3.0.0",
		description:
			"V3 — separate resonance and tonal candidate pools, adaptive selection, global optimization and filter pruning.",
	},
];

export function getEqAlgorithm(id: EqAlgorithmVersion): EqAlgorithmInfo {
	return EQ_ALGORITHMS.find((item) => item.id === id) ?? EQ_ALGORITHMS[0];
}

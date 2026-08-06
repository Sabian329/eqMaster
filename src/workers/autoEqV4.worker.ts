import { generateAutoEqV4 } from "../audio/auto-eq/v4/autoEqV4";
import type {
	AutoEqV4Options,
	AutoEqV4Progress,
	AutoEqV4Result,
	FrequencyPoint,
} from "../audio/auto-eq/v4/types";

export interface AutoEqV4WorkerInput {
	measurements: FrequencyPoint[][];
	options: Partial<AutoEqV4Options>;
}

export type AutoEqV4WorkerMessage =
	| { type: "progress"; progress: AutoEqV4Progress }
	| { type: "done"; result: AutoEqV4Result }
	| { type: "error"; message: string };

self.onmessage = (event: MessageEvent<AutoEqV4WorkerInput>) => {
	const { measurements, options } = event.data;

	try {
		const result = generateAutoEqV4(measurements, options, (progress) => {
			const message: AutoEqV4WorkerMessage = { type: "progress", progress };
			self.postMessage(message);
		});

		const doneMessage: AutoEqV4WorkerMessage = { type: "done", result };
		self.postMessage(doneMessage);
	} catch (error) {
		const message: AutoEqV4WorkerMessage = {
			type: "error",
			message: error instanceof Error ? error.message : "Auto EQ V4 failed.",
		};
		self.postMessage(message);
	}
};

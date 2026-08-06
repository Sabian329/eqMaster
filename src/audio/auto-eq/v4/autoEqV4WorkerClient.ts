import AutoEqV4Worker from "../../../workers/autoEqV4.worker?worker";
import type { AutoEqV4Options, AutoEqV4Progress, AutoEqV4Result, FrequencyPoint } from "./types";

export interface RunAutoEqV4WorkerOptions {
	measurements: FrequencyPoint[][];
	options?: Partial<AutoEqV4Options>;
	onProgress?: (progress: AutoEqV4Progress) => void;
	signal?: AbortSignal;
}

export function runAutoEqV4Worker({
	measurements,
	options = {},
	onProgress,
	signal,
}: RunAutoEqV4WorkerOptions): Promise<AutoEqV4Result> {
	return new Promise((resolve, reject) => {
		const worker = new AutoEqV4Worker();

		const abort = () => {
			worker.terminate();
			reject(new Error("Auto EQ V4 cancelled."));
		};

		if (signal?.aborted) {
			abort();
			return;
		}

		signal?.addEventListener("abort", abort, { once: true });

		worker.onmessage = (event: MessageEvent) => {
			const message = event.data;
			if (message.type === "progress") {
				onProgress?.(message.progress);
				return;
			}

			worker.terminate();
			signal?.removeEventListener("abort", abort);

			if (message.type === "done") {
				resolve(message.result);
				return;
			}

			reject(new Error(message.message));
		};

		worker.onerror = () => {
			worker.terminate();
			signal?.removeEventListener("abort", abort);
			reject(new Error("Auto EQ V4 worker failed."));
		};

		worker.postMessage({ measurements, options });
	});
}

export { generateAutoEqV4 } from "./autoEqV4";

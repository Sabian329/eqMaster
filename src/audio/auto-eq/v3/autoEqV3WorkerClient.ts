import AutoEqV3Worker from '../../../workers/autoEqV3.worker?worker';
import type { AutoEqV3Options, AutoEqV3Progress, AutoEqV3Result, FrequencyPoint } from './types';

export interface RunAutoEqV3WorkerOptions {
  measurements: FrequencyPoint[][];
  options?: Partial<AutoEqV3Options>;
  onProgress?: (progress: AutoEqV3Progress) => void;
  signal?: AbortSignal;
}

export function runAutoEqV3Worker({
  measurements,
  options = {},
  onProgress,
  signal,
}: RunAutoEqV3WorkerOptions): Promise<AutoEqV3Result> {
  return new Promise((resolve, reject) => {
    const worker = new AutoEqV3Worker();

    const abort = () => {
      worker.terminate();
      reject(new Error('Auto EQ V3 cancelled.'));
    };

    if (signal?.aborted) {
      abort();
      return;
    }

    signal?.addEventListener('abort', abort, { once: true });

    worker.onmessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'progress') {
        onProgress?.(message.progress);
        return;
      }

      worker.terminate();
      signal?.removeEventListener('abort', abort);

      if (message.type === 'done') {
        resolve(message.result);
        return;
      }

      reject(new Error(message.message));
    };

    worker.onerror = () => {
      worker.terminate();
      signal?.removeEventListener('abort', abort);
      reject(new Error('Auto EQ V3 worker failed.'));
    };

    worker.postMessage({ measurements, options });
  });
}

export { generateAutoEqV3 } from './autoEqV3';

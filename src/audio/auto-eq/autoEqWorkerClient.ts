import AutoEqWorker from '../../workers/autoEq.worker?worker';
import type { AutoEqOptions, AutoEqProgress, AutoEqResultV2, FrequencyPoint } from './types';

export interface RunAutoEqV2WorkerOptions {
  measurements: FrequencyPoint[][];
  options?: Partial<AutoEqOptions>;
  onProgress?: (progress: AutoEqProgress) => void;
  signal?: AbortSignal;
}

export function runAutoEqV2Worker({
  measurements,
  options = {},
  onProgress,
  signal,
}: RunAutoEqV2WorkerOptions): Promise<AutoEqResultV2> {
  return new Promise((resolve, reject) => {
    const worker = new AutoEqWorker();

    const abort = () => {
      worker.terminate();
      reject(new Error('Auto EQ V2 cancelled.'));
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
      reject(new Error('Auto EQ V2 worker failed.'));
    };

    worker.postMessage({ measurements, options });
  });
}

export { generateAutoEqV2 } from './autoEq';

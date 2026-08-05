import { generateAutoEqV2 } from '../audio/auto-eq/autoEq';
import type { AutoEqOptions, AutoEqProgress, AutoEqResultV2, FrequencyPoint } from '../audio/auto-eq/types';

export interface AutoEqWorkerInput {
  measurements: FrequencyPoint[][];
  options: Partial<AutoEqOptions>;
}

export type AutoEqWorkerMessage =
  | { type: 'progress'; progress: AutoEqProgress }
  | { type: 'done'; result: AutoEqResultV2 }
  | { type: 'error'; message: string };

self.onmessage = (event: MessageEvent<AutoEqWorkerInput>) => {
  const { measurements, options } = event.data;

  try {
    const result = generateAutoEqV2(measurements, options, (progress) => {
      const message: AutoEqWorkerMessage = { type: 'progress', progress };
      self.postMessage(message);
    });

    const doneMessage: AutoEqWorkerMessage = { type: 'done', result };
    self.postMessage(doneMessage);
  } catch (error) {
    const message: AutoEqWorkerMessage = {
      type: 'error',
      message: error instanceof Error ? error.message : 'Auto EQ V2 failed.',
    };
    self.postMessage(message);
  }
};

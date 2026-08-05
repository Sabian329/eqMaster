import { generateAutoEqV3 } from '../audio/auto-eq/v3/autoEqV3';
import type {
  AutoEqV3Options,
  AutoEqV3Progress,
  AutoEqV3Result,
  FrequencyPoint,
} from '../audio/auto-eq/v3/types';

export interface AutoEqV3WorkerInput {
  measurements: FrequencyPoint[][];
  options: Partial<AutoEqV3Options>;
}

export type AutoEqV3WorkerMessage =
  | { type: 'progress'; progress: AutoEqV3Progress }
  | { type: 'done'; result: AutoEqV3Result }
  | { type: 'error'; message: string };

self.onmessage = (event: MessageEvent<AutoEqV3WorkerInput>) => {
  const { measurements, options } = event.data;

  try {
    const result = generateAutoEqV3(measurements, options, (progress) => {
      const message: AutoEqV3WorkerMessage = { type: 'progress', progress };
      self.postMessage(message);
    });

    const doneMessage: AutoEqV3WorkerMessage = { type: 'done', result };
    self.postMessage(doneMessage);
  } catch (error) {
    const message: AutoEqV3WorkerMessage = {
      type: 'error',
      message: error instanceof Error ? error.message : 'Auto EQ V3 failed.',
    };
    self.postMessage(message);
  }
};

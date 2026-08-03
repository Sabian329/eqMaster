interface MediaDeviceInfoWithOutput extends MediaDeviceInfo {
  deviceId: string;
}

interface AudioOutputOptions {
  deviceId?: string;
}

interface MediaDevices {
  selectAudioOutput(options?: AudioOutputOptions): Promise<MediaDeviceInfoWithOutput>;
}

interface AudioContext {
  setSinkId(sinkId: string): Promise<void>;
}

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: AudioWorkletNodeOptions);
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor,
): void;

declare const currentFrame: number;

declare const sampleRate: number;

declare const globalScope: {
  registerProcessor: typeof registerProcessor;
};

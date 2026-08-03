class PCMRecorderProcessor extends AudioWorkletProcessor {
  private recording = false;
  private capacity = 8192;
  private buffer: Float32Array;
  private index = 0;
  private frameStart = 0;

  constructor() {
    super();
    this.buffer = new Float32Array(this.capacity);

    this.port.onmessage = (event: MessageEvent) => {
      const message = event.data || {};
      if (message.type === 'start') {
        this.index = 0;
        this.recording = true;
        this.port.postMessage({ type: 'started' });
      } else if (message.type === 'stop') {
        this.recording = false;
        this.flush();
        this.port.postMessage({ type: 'stopped' });
      }
    };
  }

  flush(): void {
    if (!this.index) return;
    const output = this.buffer.slice(0, this.index);
    this.port.postMessage(
      { type: 'chunk', frame: this.frameStart, data: output },
      [output.buffer],
    );
    this.buffer = new Float32Array(this.capacity);
    this.index = 0;
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
  ): boolean {
    const output = outputs[0];
    if (output) {
      for (const channel of output) channel.fill(0);
    }

    const input = inputs[0];
    const channel = input && input[0];

    if (this.recording && channel) {
      let sourceOffset = 0;

      while (sourceOffset < channel.length) {
        if (this.index === 0) {
          this.frameStart = currentFrame + sourceOffset;
        }

        const free = this.capacity - this.index;
        const count = Math.min(free, channel.length - sourceOffset);
        this.buffer.set(
          channel.subarray(sourceOffset, sourceOffset + count),
          this.index,
        );

        this.index += count;
        sourceOffset += count;

        if (this.index === this.capacity) this.flush();
      }
    }

    return true;
  }
}

registerProcessor('pcm-recorder-processor', PCMRecorderProcessor);

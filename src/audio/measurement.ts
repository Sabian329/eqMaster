import type { AnalysisResult, ChannelMode, MeasurementMeta, RecorderChunk } from '../types';
import AnalysisWorker from '../workers/analysis.worker?worker';
import workletUrl from '../worklets/pcm-recorder-processor.ts?url';
import { connectEqChain, renderSweepWithEq, type EqApplyProfile } from './eqChain';
import {
  bindMeasurementAbort,
  createMeasurementAbortError,
  throwIfMeasurementAborted,
  waitForAbort,
} from './measurementAbort';
import {
  readMeasurementAudioFrame,
  type MeasurementAudioFrame,
} from './measurementAudioVisual';
import {
  connectInputChannel,
  createRecorderTap,
  openMeasurementInput,
} from './inputCapture';
import { detectPossibleLoopback, LOOPBACK_WARNING } from './loopbackDetect';
import {
  createAudioContext,
  makePinkNoise,
  makeSweep,
  makeSweepBuffer,
  setOutputDevice,
} from './sweep';

export function assembleChunks(chunks: RecorderChunk[]): {
  data: Float32Array;
  firstFrame: number;
} {
  if (!chunks.length) throw new Error('No samples received from the microphone.');

  chunks.sort((a, b) => a.frame - b.frame);
  const firstFrame = chunks[0].frame;
  const last = chunks[chunks.length - 1];
  const totalLength = last.frame + last.data.length - firstFrame;
  const data = new Float32Array(totalLength);

  for (const chunk of chunks) {
    data.set(chunk.data, chunk.frame - firstFrame);
  }

  return { data, firstFrame };
}

export function signalStats(
  recorded: Float32Array,
  sweepOffset: number,
  sampleRate: number,
): { peakDb: number; noiseDb: number } {
  let peak = 0;
  for (let i = 0; i < recorded.length; i++) {
    peak = Math.max(peak, Math.abs(recorded[i]));
  }

  const noiseEnd = Math.max(
    1,
    Math.min(recorded.length, sweepOffset - Math.round(sampleRate * 0.12)),
  );

  let noiseSquare = 0;
  for (let i = 0; i < noiseEnd; i++) {
    noiseSquare += recorded[i] * recorded[i];
  }

  const noiseRms = Math.sqrt(noiseSquare / noiseEnd);
  return {
    peakDb: peak > 0 ? 20 * Math.log10(peak) : -Infinity,
    noiseDb: noiseRms > 0 ? 20 * Math.log10(noiseRms) : -Infinity,
  };
}

export function analyzeInWorker(payload: {
  recorded: Float32Array;
  sweep: Float32Array;
  sampleRate: number;
  sweepOffset: number;
  fMin: number;
  fMax: number;
  smoothing: number;
  calibration: [number, number][];
  onProgress?: (label: string, value: number) => void;
  abortSignal?: AbortSignal;
}): Promise<AnalysisResult> {
  return new Promise((resolve, reject) => {
    const worker = new AnalysisWorker();

    const onAbort = () => {
      worker.terminate();
      reject(createMeasurementAbortError());
    };
    const unbindAbort = bindMeasurementAbort(payload.abortSignal, onAbort);

    worker.onmessage = (event: MessageEvent) => {
      const message = event.data || {};

      if (message.type === 'progress') {
        payload.onProgress?.(message.label || 'Analyzing…', message.value || 75);
      } else if (message.type === 'done') {
        unbindAbort();
        worker.terminate();
        resolve(message.result);
      } else if (message.type === 'error') {
        unbindAbort();
        worker.terminate();
        reject(new Error(message.message || 'Analysis error.'));
      }
    };

    worker.onerror = (event: ErrorEvent) => {
      unbindAbort();
      worker.terminate();
      reject(new Error(event.message || 'Analysis worker error.'));
    };

    throwIfMeasurementAborted(payload.abortSignal);

    worker.postMessage(
      {
        recordedBuffer: payload.recorded.buffer,
        sweepBuffer: payload.sweep.buffer,
        sampleRate: payload.sampleRate,
        sweepOffset: payload.sweepOffset,
        fMin: payload.fMin,
        fMax: payload.fMax,
        smoothing: payload.smoothing,
        calibration: payload.calibration,
      },
      [payload.recorded.buffer, payload.sweep.buffer],
    );
  });
}

export interface RunMeasurementParams {
  inputDeviceId: string;
  outputDeviceId: string;
  channel: ChannelMode;
  fMin: number;
  fMax: number;
  durationSeconds: number;
  smoothing: number;
  levelDb: number;
  calibration: [number, number][];
  inputLabel: string;
  outputLabel: string;
  onStatus: (text: string, progress: number) => void;
  onAudioFrame?: (frame: MeasurementAudioFrame) => void;
  abortSignal?: AbortSignal;
  eqApply?: EqApplyProfile;
  inputChannelIndex?: number;
}

export interface RunMeasurementResult {
  curve: AnalysisResult['curve'];
  suggestions: AnalysisResult['suggestions'];
  measurementMeta: MeasurementMeta;
}

export async function runMeasurement(
  params: RunMeasurementParams,
): Promise<RunMeasurementResult> {
  const {
    inputDeviceId,
    outputDeviceId,
    channel,
    fMin,
    durationSeconds,
    smoothing,
    levelDb,
    calibration,
    inputLabel,
    outputLabel,
    onStatus,
    onAudioFrame,
    eqApply,
    abortSignal,
    inputChannelIndex = 0,
  } = params;
  let fMax = params.fMax;

  throwIfMeasurementAborted(abortSignal);

  if (!Number.isFinite(fMin) || !Number.isFinite(fMax) || fMin < 10 || fMax <= fMin) {
    throw new Error('Check the sweep frequency range.');
  }

  onStatus('Preparing microphone…', 3);

  let context: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let micSource: MediaStreamAudioSourceNode | null = null;
  let inputTap: AudioNode | null = null;
  let recorder: AudioWorkletNode | ScriptProcessorNode | null = null;
  let recorderTap: AudioNode | null = null;
  let playback: AudioBufferSourceNode | null = null;
  let visualAnalyser: AnalyserNode | null = null;
  let visualRafId = 0;
  let measurementTimer: ReturnType<typeof setInterval> | null = null;
  let stopRecorder: () => void = () => {};
  let unbindAbort: (() => void) | null = null;
  let capturedChannelCount = 1;

  try {
    const opened = await openMeasurementInput(inputDeviceId);
    stream = opened.stream;
    capturedChannelCount = opened.channelCount;
    throwIfMeasurementAborted(abortSignal);
    const settings = opened.settings;

    context = createAudioContext();
    await setOutputDevice(context, outputDeviceId);
    await context.resume();

    if (context.sampleRate < fMax * 2.1) {
      fMax = Math.floor(context.sampleRate * 0.45);
    }

    const actualFMax = Math.min(fMax, context.sampleRate * 0.45);
    const sweepData = makeSweep(
      context.sampleRate,
      fMin,
      actualFMax,
      durationSeconds,
      levelDb,
    );

    micSource = context.createMediaStreamSource(stream);

    const chunks: RecorderChunk[] = [];
    let stoppedResolve: () => void;
    const stoppedPromise = new Promise<void>((resolve) => {
      stoppedResolve = resolve;
    });
    let recorderMode = 'AudioWorklet';

    try {
      if (!context.audioWorklet || typeof AudioWorkletNode === 'undefined') {
        throw new Error('AudioWorklet is not available in this browser.');
      }

      await context.audioWorklet.addModule(workletUrl);

      recorder = new AudioWorkletNode(context, 'pcm-recorder-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'discrete',
      });

      recorder.port.onmessage = (event: MessageEvent) => {
        const message = event.data || {};
        if (message.type === 'chunk') {
          chunks.push({ frame: message.frame, data: message.data });
        } else if (message.type === 'stopped') {
          stoppedResolve();
        }
      };

      inputTap = connectInputChannel(
        micSource,
        recorder,
        inputChannelIndex,
        capturedChannelCount,
      );
      recorderTap = createRecorderTap(context);
      recorder.connect(recorderTap);
          recorder.port.postMessage({ type: 'start' });
          stopRecorder = () => {
            (recorder as AudioWorkletNode).port.postMessage({ type: 'stop' });
          };
    } catch (workletError) {
      console.warn(
        'AudioWorklet failed to start. Using compatibility mode.',
        workletError,
      );
      recorderMode = 'ScriptProcessor (compatibility mode)';

      if (typeof context.createScriptProcessor !== 'function') {
        throw new Error(
          'The browser blocked AudioWorklet and does not support compatibility mode. ' +
            'Run the app over localhost in current Chrome or Edge.',
        );
      }

      const processor = context.createScriptProcessor(4096, 1, 1);
      let recording = true;
      let nextFrame: number | null = null;

      processor.onaudioprocess = (event: AudioProcessingEvent) => {
        const output = event.outputBuffer;
        for (let ch = 0; ch < output.numberOfChannels; ch++) {
          output.getChannelData(ch).fill(0);
        }

        if (!recording || !event.inputBuffer.numberOfChannels) return;

        const input = event.inputBuffer.getChannelData(0);
        const data = new Float32Array(input.length);
        data.set(input);

        const eventFrame = Math.round(
          (Number.isFinite(event.playbackTime) ? event.playbackTime : context!.currentTime) *
            context!.sampleRate,
        );
        const frame = nextFrame === null ? eventFrame : nextFrame;
        chunks.push({ frame, data });
        nextFrame = frame + data.length;
      };

      recorder = processor;
      inputTap = connectInputChannel(
        micSource,
        processor,
        inputChannelIndex,
        capturedChannelCount,
      );
      recorderTap = createRecorderTap(context);
      processor.connect(recorderTap);

      stopRecorder = () => {
        recording = false;
        stoppedResolve();
      };
    }

    onStatus(
      recorderMode === 'AudioWorklet'
        ? 'Room quiet — measuring background noise…'
        : 'Compatibility mode active — measuring background noise…',
      8,
    );

    const preRollSeconds = 0.9;
    const tailSeconds = 2.2;
    const startTime = context.currentTime + preRollSeconds;
    const sweepStartFrame = Math.round(startTime * context.sampleRate);

    playback = context.createBufferSource();
    playback.buffer = makeSweepBuffer(context, sweepData, channel);

    visualAnalyser = context.createAnalyser();
    visualAnalyser.fftSize = 2048;
    visualAnalyser.smoothingTimeConstant = 0.55;

    const visualBus = context.createGain();
    if (eqApply) {
      connectEqChain(context, playback, visualBus, eqApply);
    } else {
      playback.connect(visualBus);
    }
    visualBus.connect(visualAnalyser);
    visualAnalyser.connect(context.destination);

    if (onAudioFrame) {
      const pumpVisual = () => {
        if (visualAnalyser) {
          onAudioFrame(readMeasurementAudioFrame(visualAnalyser));
        }
        visualRafId = requestAnimationFrame(pumpVisual);
      };
      visualRafId = requestAnimationFrame(pumpVisual);
    }

    playback.start(startTime);

    unbindAbort = bindMeasurementAbort(abortSignal, () => {
      if (measurementTimer) {
        clearInterval(measurementTimer);
        measurementTimer = null;
      }
      cancelAnimationFrame(visualRafId);
      visualRafId = 0;
      try {
        playback?.stop();
      } catch {
        /* ignore */
      }
      stopRecorder();
    });

    const totalSeconds = preRollSeconds + durationSeconds + tailSeconds;
    const measurementStart = performance.now();

    await Promise.race([
      new Promise<void>((resolve, reject) => {
        measurementTimer = setInterval(() => {
          if (abortSignal?.aborted) {
            if (measurementTimer) clearInterval(measurementTimer);
            measurementTimer = null;
            reject(createMeasurementAbortError());
            return;
          }

          const elapsed = (performance.now() - measurementStart) / 1000;
          const fraction = Math.min(1, elapsed / totalSeconds);
          const progress = 8 + fraction * 62;

          if (elapsed < preRollSeconds) {
            onStatus('Room quiet — measuring background noise…', progress);
          } else if (elapsed < preRollSeconds + durationSeconds) {
            onStatus(
              eqApply
                ? 'Sweep with EQ in progress — keep the microphone still…'
                : 'Sweep in progress — keep the microphone still…',
              progress,
            );
          } else {
            onStatus('Recording room decay…', progress);
          }

          if (fraction >= 1) {
            if (measurementTimer) clearInterval(measurementTimer);
            measurementTimer = null;
            resolve();
          }
        }, 80);
      }),
      waitForAbort(abortSignal),
    ]);

    throwIfMeasurementAborted(abortSignal);
    stopRecorder();
    await Promise.race([
      stoppedPromise,
      new Promise<void>((resolve) => setTimeout(resolve, 500)),
    ]);

    throwIfMeasurementAborted(abortSignal);

    const assembled = assembleChunks(chunks);
    const sweepOffset = sweepStartFrame - assembled.firstFrame;
    const stats = signalStats(assembled.data, sweepOffset, context.sampleRate);

    if (stats.peakDb > -0.5) {
      throw new Error(
        'Input was clipped. Lower microphone/interface gain and repeat the measurement.',
      );
    }

    if (stats.peakDb < -50) {
      throw new Error(
        'Signal is very quiet. Check routing, output, and microphone gain.',
      );
    }

    onStatus('Analyzing data…', 72);

    const analysisSweep = eqApply
      ? await renderSweepWithEq(context.sampleRate, sweepData, channel, eqApply)
      : sweepData;

    const loopback = detectPossibleLoopback({
      recorded: assembled.data,
      sweep: analysisSweep,
      sampleRate: context.sampleRate,
      sweepOffset,
      peakDb: stats.peakDb,
      noiseDb: stats.noiseDb,
    });

    const result = await analyzeInWorker({
      recorded: assembled.data,
      sweep: analysisSweep,
      sampleRate: context.sampleRate,
      sweepOffset,
      fMin,
      fMax: actualFMax,
      smoothing,
      calibration,
      onProgress: onStatus,
      abortSignal,
    });

    const measurementMeta: MeasurementMeta = {
      date: new Date().toISOString(),
      sampleRate: context.sampleRate,
      samples: assembled.data.length,
      peakDb: stats.peakDb,
      noiseDb: stats.noiseDb,
      fMin,
      fMax: actualFMax,
      durationSeconds,
      smoothing,
      levelDb,
      channel,
      inputLabel,
      outputLabel,
      inputChannel: inputChannelIndex,
      inputChannelCount: capturedChannelCount,
      loopbackWarning: loopback.suspected ? LOOPBACK_WARNING : undefined,
      trackSettings: settings,
      fftSize: result.fftSize,
      calibrationPoints: calibration.length,
      recorderMode,
      verificationMode: Boolean(eqApply),
    };

    return {
      curve: result.curve,
      suggestions: result.suggestions,
      measurementMeta,
    };
  } finally {
    unbindAbort?.();
    if (measurementTimer) {
      clearInterval(measurementTimer);
    }
    cancelAnimationFrame(visualRafId);
    onAudioFrame?.({ level: 0, centroid: 0.15 });
    try {
      playback?.stop();
    } catch {
      /* ignore */
    }
    try {
      playback?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      inputTap?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      micSource?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      recorder?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      recorderTap?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      visualAnalyser?.disconnect();
    } catch {
      /* ignore */
    }
    stream?.getTracks().forEach((track) => track.stop());
    try {
      await context?.close();
    } catch {
      /* ignore */
    }
  }
}

export interface LevelTestOptions {
  levelDb: number;
  channel: ChannelMode;
  inputChannelIndex?: number;
  playStimulus?: boolean;
}

export async function startLevelTest(
  inputDeviceId: string,
  outputDeviceId: string,
  onLevel: (db: number) => void,
  options: LevelTestOptions,
): Promise<{
  stop: () => Promise<void>;
  channelCount: number;
}> {
  const playStimulus = options.playStimulus !== false;
  const opened = await openMeasurementInput(inputDeviceId);
  const stream = opened.stream;
  const context = createAudioContext();
  if (playStimulus) {
    await setOutputDevice(context, outputDeviceId);
  }
  await context.resume();

  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.25;
  analyser.channelCount = 1;
  analyser.channelCountMode = 'explicit';
  analyser.channelInterpretation = 'discrete';
  const inputTap = connectInputChannel(
    source,
    analyser,
    options.inputChannelIndex ?? 0,
    opened.channelCount,
  );
  const analyserTap = createRecorderTap(context);
  analyser.connect(analyserTap);

  let playback: AudioBufferSourceNode | null = null;
  if (playStimulus) {
    const noiseData = makePinkNoise(context.sampleRate, 2.5, options.levelDb);
    playback = context.createBufferSource();
    playback.buffer = makeSweepBuffer(context, noiseData, options.channel);
    playback.loop = true;
    playback.connect(context.destination);
    playback.start();
  }

  const samples = new Float32Array(analyser.fftSize);
  let rafId = 0;

  const render = () => {
    analyser.getFloatTimeDomainData(samples);
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      peak = Math.max(peak, Math.abs(samples[i]));
    }
    const db = peak > 0 ? 20 * Math.log10(peak) : -Infinity;
    onLevel(db);
    rafId = requestAnimationFrame(render);
  };

  render();

  return {
    channelCount: opened.channelCount,
    stop: async () => {
      cancelAnimationFrame(rafId);
      try {
        playback?.stop();
      } catch {
        /* ignore */
      }
      try {
        playback?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        inputTap.disconnect();
      } catch {
        /* ignore */
      }
      try {
        source.disconnect();
      } catch {
        /* ignore */
      }
      try {
        analyser.disconnect();
      } catch {
        /* ignore */
      }
      try {
        analyserTap.disconnect();
      } catch {
        /* ignore */
      }
      stream.getTracks().forEach((track) => track.stop());
      try {
        await context.close();
      } catch {
        /* ignore */
      }
    },
  };
}

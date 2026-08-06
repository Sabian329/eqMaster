export const MEASUREMENT_ABORT_MESSAGE =
  'Measurement stopped. Adjust output or mic gain and try again.';

export function createMeasurementAbortError(): DOMException {
  return new DOMException(MEASUREMENT_ABORT_MESSAGE, 'AbortError');
}

export function isMeasurementAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function throwIfMeasurementAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createMeasurementAbortError();
  }
}

export function waitForAbort(signal?: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (!signal) return;
    if (signal.aborted) {
      reject(createMeasurementAbortError());
      return;
    }
    signal.addEventListener(
      'abort',
      () => {
        reject(createMeasurementAbortError());
      },
      { once: true },
    );
  });
}

export function bindMeasurementAbort(
  signal: AbortSignal | undefined,
  onAbort: () => void,
): () => void {
  if (!signal) return () => {};

  const handler = () => {
    onAbort();
  };

  if (signal.aborted) {
    onAbort();
    return () => {};
  }

  signal.addEventListener('abort', handler, { once: true });
  return () => signal.removeEventListener('abort', handler);
}

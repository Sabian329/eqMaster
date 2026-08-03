export function parseCalibration(text: string): [number, number][] {
  const points: [number, number][] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('*') || line.startsWith(';')) {
      continue;
    }

    const normalized = line.replace(/,/g, '.').replace(/;/g, ' ');
    const values = normalized.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g);
    if (!values || values.length < 2) continue;

    const frequency = Number(values[0]);
    const correction = Number(values[1]);

    if (
      Number.isFinite(frequency) &&
      Number.isFinite(correction) &&
      frequency > 0 &&
      frequency <= 100000 &&
      Math.abs(correction) < 100
    ) {
      points.push([frequency, correction]);
    }
  }

  points.sort((a, b) => a[0] - b[0]);

  const deduplicated: [number, number][] = [];
  for (const point of points) {
    const last = deduplicated[deduplicated.length - 1];
    if (last && Math.abs(last[0] - point[0]) < 1e-9) {
      last[1] = point[1];
    } else {
      deduplicated.push(point);
    }
  }

  return deduplicated;
}

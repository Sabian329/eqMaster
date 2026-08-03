import type { ChartBounds, ChartSeries, CurvePoint } from '../types';

function strokeSeries(
  context: CanvasRenderingContext2D,
  curve: CurvePoint[],
  xForFrequency: (frequency: number) => number,
  yForDb: (db: number) => number,
  color: string,
  lineWidth: number,
  alpha = 1,
  dash?: number[],
) {
  context.strokeStyle = color;
  context.globalAlpha = alpha;
  context.lineWidth = lineWidth;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.setLineDash(dash ?? []);
  context.beginPath();

  curve.forEach((point, index) => {
    const x = xForFrequency(point.frequency);
    const y = yForDb(point.db);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });

  context.stroke();
  context.setLineDash([]);
}

export function drawChart(
  canvas: HTMLCanvasElement,
  series: ChartSeries[],
  fMin: number,
  fMax: number,
): ChartBounds | null {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.max(320, rect.width);
  const height = Math.max(360, rect.height);

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  const context = canvas.getContext('2d');
  if (!context) return null;

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  const allPoints = series.flatMap((item) => item.curve);
  if (!allPoints.length) return null;

  const styles = getComputedStyle(document.documentElement);
  const lineColor = styles.getPropertyValue('--line').trim();
  const mutedColor = styles.getPropertyValue('--muted').trim();
  const targetColor = styles.getPropertyValue('--good').trim();

  const padding = { left: 58, right: 20, top: 22, bottom: 44 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const rawValues = allPoints.map((point) => point.db).sort((a, b) => a - b);
  const pick = (fraction: number) =>
    rawValues[Math.max(0, Math.min(rawValues.length - 1, Math.floor(fraction * (rawValues.length - 1))))];
  const rawMin = Math.max(-60, pick(0.02));
  const rawMax = Math.min(40, pick(0.98));
  let yMin = Math.floor((Math.max(-60, rawMin) - 3) / 5) * 5;
  let yMax = Math.ceil((Math.min(40, rawMax) + 3) / 5) * 5;

  if (yMax - yMin < 30) {
    const middle = (yMax + yMin) / 2;
    yMin = Math.floor((middle - 15) / 5) * 5;
    yMax = Math.ceil((middle + 15) / 5) * 5;
  }

  const logMin = Math.log10(fMin);
  const logMax = Math.log10(fMax);
  const xForFrequency = (frequency: number) =>
    padding.left + ((Math.log10(frequency) - logMin) / (logMax - logMin)) * plotWidth;
  const yForDb = (db: number) =>
    padding.top + ((yMax - db) / (yMax - yMin)) * plotHeight;

  context.font = '11px system-ui, sans-serif';
  context.textBaseline = 'middle';
  context.lineWidth = 1;

  const yStep = yMax - yMin > 50 ? 10 : 5;
  for (let db = Math.ceil(yMin / yStep) * yStep; db <= yMax; db += yStep) {
    const y = yForDb(db);
    context.strokeStyle = lineColor;
    context.globalAlpha = db === 0 ? 0.9 : 0.55;
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();

    context.globalAlpha = 1;
    context.fillStyle = mutedColor;
    context.textAlign = 'right';
    context.fillText(`${db} dB`, padding.left - 9, y);
  }

  const frequencyTicks = [20, 30, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000, 20000];
  for (const frequency of frequencyTicks) {
    if (frequency < fMin || frequency > fMax) continue;
    const x = xForFrequency(frequency);
    context.strokeStyle = lineColor;
    context.globalAlpha = [20, 100, 1000, 10000, 20000].includes(frequency) ? 0.7 : 0.3;
    context.beginPath();
    context.moveTo(x, padding.top);
    context.lineTo(x, height - padding.bottom);
    context.stroke();

    context.globalAlpha = 1;
    context.fillStyle = mutedColor;
    context.textAlign = 'center';
    const label =
      frequency >= 1000 ? `${frequency / 1000}k` : String(frequency);
    context.fillText(label, x, height - padding.bottom + 18);
  }

  if (yMin <= 0 && yMax >= 0 && !series.some((item) => item.id === 'target')) {
    const y = yForDb(0);
    context.strokeStyle = targetColor;
    context.globalAlpha = 0.95;
    context.setLineDash([7, 6]);
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(width - padding.right, y);
    context.stroke();
    context.setLineDash([]);
  }

  context.save();
  context.beginPath();
  context.rect(padding.left, padding.top, plotWidth, plotHeight);
  context.clip();

  const ordered = [...series].sort((a, b) => {
    if (a.id === 'target') return -1;
    if (b.id === 'target') return 1;
    if (a.id === 'average') return 1;
    if (b.id === 'average') return -1;
    return 0;
  });

  for (const item of ordered) {
    if (!item.curve.length) continue;
    strokeSeries(
      context,
      item.curve,
      xForFrequency,
      yForDb,
      item.color,
      item.lineWidth,
      item.alpha ?? 1,
      item.dash,
    );
  }

  context.restore();

  context.strokeStyle = lineColor;
  context.globalAlpha = 1;
  context.lineWidth = 1;
  context.strokeRect(padding.left, padding.top, plotWidth, plotHeight);

  return {
    padding,
    width,
    height,
    plotWidth,
    plotHeight,
    fMin,
    fMax,
    yMin,
    yMax,
    xForFrequency,
    yForDb,
  };
}

export function nearestCurvePoint(
  curve: CurvePoint[],
  clientX: number,
  canvas: HTMLCanvasElement,
  bounds: ChartBounds,
): CurvePoint | null {
  if (!curve.length) return null;

  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const fraction = Math.max(0, Math.min(1, (x - bounds.padding.left) / bounds.plotWidth));
  const frequency = bounds.fMin * Math.pow(bounds.fMax / bounds.fMin, fraction);

  let low = 0;
  let high = curve.length - 1;

  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (curve[middle].frequency <= frequency) low = middle;
    else high = middle;
  }

  return Math.abs(curve[low].frequency - frequency) <
    Math.abs(curve[high].frequency - frequency)
    ? curve[low]
    : curve[high];
}

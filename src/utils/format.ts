export function formatDb(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '−∞ dB';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)} dB`;
}

export function formatFrequency(value: number): string {
  if (value >= 1000) {
    const precision = value >= 10000 ? 0 : 1;
    return `${(value / 1000).toFixed(precision).replace('.0', '')} kHz`;
  }
  return `${Math.round(value)} Hz`;
}

export function dbToMeterPercent(db: number): number {
  return Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
}

export function compactNumber(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Number(value.toFixed(decimals));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

export function qToBandwidthOctaves(q: number): number {
  const safeQ = Math.max(0.05, Number(q) || 1);
  return (2 * Math.asinh(1 / (2 * safeQ))) / Math.LN2;
}

export const BAND_COLORS = [
  '#ff8c42',
  '#ffb347',
  '#ffd166',
  '#c9e265',
  '#7dd957',
  '#52d1b6',
  '#4ecdc4',
  '#5b9cf6',
  '#7c83fd',
  '#a78bfa',
  '#c084fc',
  '#f472b6',
  '#fb7185',
  '#f97316',
  '#eab308',
  '#84cc16',
] as const;

export function bandColorForIndex(index: number): string {
  return BAND_COLORS[index % BAND_COLORS.length];
}

export const MEASUREMENT_NAME_TAGS = [
  { id: 'room', label: 'Room' },
  { id: 'studio', label: 'Studio' },
  { id: 'car', label: 'Car' },
  { id: 'monitors', label: 'Monitors' },
  { id: 'living-room', label: 'Living room' },
  { id: 'nearfield', label: 'Nearfield' },
  { id: 'desktop', label: 'Desktop' },
  { id: 'custom', label: 'Custom…' },
] as const;

export type MeasurementNameTagId = (typeof MEASUREMENT_NAME_TAGS)[number]['id'];

export function resolveMeasurementNameLabel(
  tagId: MeasurementNameTagId,
  customLabel: string,
): string {
  if (tagId === 'custom') {
    const trimmed = customLabel.replace(/\s+/g, ' ').trim();
    return trimmed || 'Custom';
  }
  return (
    MEASUREMENT_NAME_TAGS.find((item) => item.id === tagId)?.label ?? 'Room'
  );
}

export function measurementPresetToNameTag(
  presetId: string | null | undefined,
): MeasurementNameTagId {
  if (presetId === 'studio' || presetId === 'car' || presetId === 'room') {
    return presetId;
  }
  return 'room';
}

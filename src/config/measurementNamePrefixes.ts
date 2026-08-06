export const MEASUREMENT_NAME_PREFIX_OPTIONS = [
  { id: 'room', label: 'Room' },
  { id: 'studio', label: 'Studio' },
  { id: 'car', label: 'Car' },
  { id: 'monitors', label: 'Monitors' },
  { id: 'headphones', label: 'Headphones' },
  { id: 'desk', label: 'Desk' },
  { id: 'live', label: 'Live venue' },
  { id: 'custom', label: 'Custom…' },
] as const;

export type MeasurementNamePrefixId =
  (typeof MEASUREMENT_NAME_PREFIX_OPTIONS)[number]['id'];

export function resolveMeasurementNamePrefix(
  prefixId: MeasurementNamePrefixId,
  customPrefix: string,
): string {
  if (prefixId === 'custom') {
    return customPrefix.replace(/[\r\n]+/g, ' ').trim();
  }
  return (
    MEASUREMENT_NAME_PREFIX_OPTIONS.find((item) => item.id === prefixId)
      ?.label ?? 'Room'
  );
}

export function joinMeasurementNameParts(
  ...parts: Array<string | null | undefined>
): string {
  return parts
    .map((part) => (part ?? '').replace(/[\r\n]+/g, ' ').trim())
    .filter((part) => part.length > 0)
    .join(' · ');
}

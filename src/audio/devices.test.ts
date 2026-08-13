import { describe, expect, it } from 'vitest';
import { deduplicateDevices, isAliasDeviceId } from './devices';

describe('device enumeration', () => {
  it('keeps virtual and aggregate devices — they are valid capture targets', () => {
    const devices = [
      {
        deviceId: 'uad',
        kind: 'audioinput' as const,
        label: 'Universal Audio Thunderbolt (PCI)',
        groupId: 'a',
        toJSON: () => ({}),
      },
      {
        deviceId: 'blackhole',
        kind: 'audioinput' as const,
        label: 'BlackHole 2ch (Virtual)',
        groupId: 'b',
        toJSON: () => ({}),
      },
      {
        deviceId: 'aggregate',
        kind: 'audioinput' as const,
        label: 'REAPER AIRPODS (Aggregate)',
        groupId: 'c',
        toJSON: () => ({}),
      },
      {
        deviceId: 'default',
        kind: 'audioinput' as const,
        label: 'Default',
        groupId: 'd',
        toJSON: () => ({}),
      },
    ] as MediaDeviceInfo[];

    const unique = deduplicateDevices(devices);
    expect(unique.map((device) => device.label)).toEqual([
      'Universal Audio Thunderbolt (PCI)',
      'BlackHole 2ch (Virtual)',
      'REAPER AIRPODS (Aggregate)',
      'Default',
    ]);
    expect(unique.filter((device) => !isAliasDeviceId(device.deviceId))).toHaveLength(
      3,
    );
  });
});

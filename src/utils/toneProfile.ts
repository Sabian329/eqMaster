import type { ToneProfile, ToneProfileId } from '../config/toneProfiles';
import { getToneProfile } from '../config/toneProfiles';
import type { CurvePoint } from '../types';

export function interpolateToneTarget(profile: ToneProfile, frequency: number): number {
  const { anchors } = profile;
  if (!anchors.length) return 0;
  if (frequency <= anchors[0].frequency) return anchors[0].db;
  if (frequency >= anchors[anchors.length - 1].frequency) {
    return anchors[anchors.length - 1].db;
  }

  for (let index = 0; index < anchors.length - 1; index++) {
    const left = anchors[index];
    const right = anchors[index + 1];
    if (frequency >= left.frequency && frequency <= right.frequency) {
      const logLeft = Math.log10(left.frequency);
      const logRight = Math.log10(right.frequency);
      const fraction =
        logRight === logLeft
          ? 0
          : (Math.log10(frequency) - logLeft) / (logRight - logLeft);
      return left.db + fraction * (right.db - left.db);
    }
  }

  return 0;
}

export function buildTargetCurve(
  measuredCurve: CurvePoint[],
  profileId: ToneProfileId,
): CurvePoint[] {
  const profile = getToneProfile(profileId);
  return measuredCurve.map((point) => ({
    frequency: point.frequency,
    db: interpolateToneTarget(profile, point.frequency),
  }));
}

export function applyToneTarget(
  measuredCurve: CurvePoint[],
  profile: ToneProfile,
): CurvePoint[] {
  return measuredCurve.map((point) => ({
    frequency: point.frequency,
    db: point.db - interpolateToneTarget(profile, point.frequency),
  }));
}

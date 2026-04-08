import type { GestureResult, GestureType } from "@/lib/gestures";

type Landmark = { x: number; y: number; z: number };

export interface CustomGestureProfile {
  id: `custom_${string}`;
  label: string;
  emoji: string;
  samples: number[][];
  createdAt: string;
}

const KEYPOINTS = [0, 4, 8, 12, 16, 20, 5, 9, 13, 17];

function distance2D(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function vectorDistance(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return Infinity;
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    total += diff * diff;
  }
  return Math.sqrt(total / a.length);
}

export function createGestureSampleVector(landmarks: Landmark[]): number[] {
  if (!landmarks || landmarks.length < 21) return [];
  const wrist = landmarks[0];
  const scale = Math.max(distance2D(landmarks[0], landmarks[9]), 1e-6);

  const vector: number[] = [];
  for (const pointIndex of KEYPOINTS) {
    const point = landmarks[pointIndex];
    vector.push((point.x - wrist.x) / scale);
    vector.push((point.y - wrist.y) / scale);
  }
  return vector;
}

function mirrorSampleVector(vector: number[]): number[] {
  const mirrored = [...vector];
  for (let i = 0; i < mirrored.length; i += 2) {
    mirrored[i] = -mirrored[i];
  }
  return mirrored;
}

export function matchCustomGesture(
  landmarks: Landmark[],
  profiles: CustomGestureProfile[]
): GestureResult | null {
  if (!profiles.length) return null;

  const current = createGestureSampleVector(landmarks);
  if (!current.length) return null;
  const mirroredCurrent = mirrorSampleVector(current);

  let best:
    | {
        profile: CustomGestureProfile;
        score: number;
      }
    | null = null;

  for (const profile of profiles) {
    if (!profile.samples.length) continue;

    let minDistance = Infinity;
    for (const sample of profile.samples) {
      const direct = vectorDistance(current, sample);
      const mirrored = vectorDistance(mirroredCurrent, sample);
      minDistance = Math.min(minDistance, direct, mirrored);
    }

    const score = Math.max(0, 1 - minDistance / 0.9);
    if (!best || score > best.score) {
      best = { profile, score };
    }
  }

  if (!best || best.score < 0.62) return null;

  return {
    gesture: best.profile.id as GestureType,
    confidence: Number(best.score.toFixed(2)),
    label: best.profile.label,
    action: "Custom Gesture",
    emoji: best.profile.emoji,
  };
}

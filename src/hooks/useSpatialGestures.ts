import { useMemo } from "react";
import type { HandData } from "@/hooks/useHandTracking";
import type { SpatialGestureState, Vec3Like } from "@/lib/spatialTypes";

function distance3D(a: { x: number; y: number; z?: number }, b: { x: number; y: number; z?: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function pointFromHand(hand: HandData | undefined): Vec3Like | null {
  if (!hand?.landmarks?.[8]) return null;
  const tip = hand.landmarks[8];
  return {
    x: -(tip.x - 0.5) * 8,
    y: -(tip.y - 0.5) * 5,
    z: (tip.z ?? 0) * 8,
  };
}

function isPinching(hand: HandData | undefined) {
  if (!hand?.landmarks?.[4] || !hand?.landmarks?.[8]) return false;
  return distance3D(hand.landmarks[4], hand.landmarks[8]) < 0.065;
}

export function useSpatialGestures(hands: HandData[]): SpatialGestureState {
  return useMemo(() => {
    const primaryHand = hands[0];
    const secondaryHand = hands[1];
    const primaryPoint = pointFromHand(primaryHand);
    const secondaryPoint = pointFromHand(secondaryHand);

    return {
      primaryPinch: isPinching(primaryHand),
      secondaryPinch: isPinching(secondaryHand),
      primaryPoint,
      secondaryPoint,
      pinchDistance:
        primaryPoint && secondaryPoint ? distance3D(primaryPoint, secondaryPoint) : null,
      hoveredObjectId: null,
      grabbedObjectId: null,
    };
  }, [hands]);
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HandData } from "@/hooks/useHandTracking";
import { SOLAR_SYSTEM_OBJECTS } from "@/lib/spatialSceneData";
import { useSpatialGestures } from "@/hooks/useSpatialGestures";
import type {
  SpatialDraftStroke,
  SpatialGestureState,
  SpatialInteractionState,
  SpatialMode,
  SpatialObject,
  SpatialStrokePoint,
  Vec3Like,
} from "@/lib/spatialTypes";

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function distance3D(a: Vec3Like, b: Vec3Like) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function normalizeStroke(points: SpatialStrokePoint[]) {
  if (!points.length) return points;
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);

  return points.map((point) => ({
    x: ((point.x - minX) / width - 0.5) * 3,
    y: -((point.y - minY) / height - 0.5) * 2.2,
  }));
}

function isDrawingHand(hand: HandData) {
  const thumb = hand.landmarks?.[4];
  const index = hand.landmarks?.[8];
  if (!thumb || !index) return false;
  return Math.hypot(index.x - thumb.x, index.y - thumb.y) > 0.04;
}

function toPointerPoint(hand: HandData | undefined): Vec3Like | null {
  const tip = hand?.landmarks?.[8];
  if (!tip) return null;
  return {
    x: (tip.x - 0.5) * 8,
    y: -(tip.y - 0.5) * 5,
    z: (tip.z ?? 0) * 8,
  };
}

function isPinching(hand: HandData | undefined) {
  const thumb = hand?.landmarks?.[4];
  const index = hand?.landmarks?.[8];
  if (!thumb || !index) return false;
  return Math.hypot(index.x - thumb.x, index.y - thumb.y, (index.z ?? 0) - (thumb.z ?? 0)) < 0.065;
}

export function useSpatialInteractionController(hands: HandData[]) {
  const [mode, setMode] = useState<SpatialMode>("draw");
  const [objects, setObjects] = useState<SpatialObject[]>([]);
  const [draftStrokes, setDraftStrokes] = useState<Record<string, SpatialDraftStroke>>({});
  const [interaction, setInteraction] = useState<SpatialInteractionState>({
    hoveredObjectId: null,
    selectedObjectId: null,
    grabbedObjectId: null,
    mode: "none",
    sceneScale: 1,
    sceneZoom: 1,
  });

  const pinchScaleStartRef = useRef<number | null>(null);
  const grabbedOffsetRef = useRef<Vec3Like | null>(null);

  const gestures = useSpatialGestures(hands);

  useEffect(() => {
    if (mode !== "draw") return;

    const drawingHands = hands.filter(isDrawingHand);
    setDraftStrokes((previous) => {
      const next: Record<string, SpatialDraftStroke> = { ...previous };
      const activeIds = new Set<string>();

      for (const hand of drawingHands) {
        const tip = hand.landmarks?.[8];
        if (!tip) continue;
        activeIds.add(hand.trackId);
        const existing = next[hand.trackId] ?? { trackId: hand.trackId, points: [], active: true };
        const point = { x: tip.x * 1000, y: tip.y * 1000 };
        const lastPoint = existing.points[existing.points.length - 1];
        if (!lastPoint || Math.abs(lastPoint.x - point.x) >= 3 || Math.abs(lastPoint.y - point.y) >= 3) {
          existing.points = [...existing.points, point];
        }
        existing.active = true;
        next[hand.trackId] = existing;
      }

      for (const [trackId, stroke] of Object.entries(next)) {
        if (!activeIds.has(trackId)) {
          next[trackId] = { ...stroke, active: false };
        }
      }

      return next;
    });
  }, [hands, mode]);

  useEffect(() => {
    if (mode === "solar") {
      setObjects(SOLAR_SYSTEM_OBJECTS.map((object) => ({ ...object })));
      setInteraction((previous) => ({ ...previous, hoveredObjectId: null, selectedObjectId: null, grabbedObjectId: null, mode: "none" }));
    }
  }, [mode]);

  const commitDrawing = useCallback(() => {
    const readyStrokes = Object.values(draftStrokes).filter((stroke) => stroke.points.length >= 4);
    if (!readyStrokes.length) return;

    const nextObjects = readyStrokes.map((stroke, index) => ({
      id: randomId("drawing"),
      kind: "drawing" as const,
      label: `Sketch ${index + 1}`,
      color: stroke.trackId === "slot1" ? "#f72585" : "#4cc9f0",
      position: { x: index * 1.5 - ((readyStrokes.length - 1) * 0.75), y: 0, z: -1.8 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      defaultPosition: { x: index * 1.5 - ((readyStrokes.length - 1) * 0.75), y: 0, z: -1.8 },
      defaultRotation: { x: 0, y: 0, z: 0 },
      defaultScale: { x: 1, y: 1, z: 1 },
      hovered: false,
      selected: false,
      grabbed: false,
      physicsEnabled: false,
      points: normalizeStroke(stroke.points),
    }));

    setObjects((previous) => [...previous, ...nextObjects]);
    setDraftStrokes({});
    setInteraction((previous) => ({
      ...previous,
      hoveredObjectId: null,
      selectedObjectId: null,
      grabbedObjectId: null,
      mode: "none",
    }));
    setMode("spatial");
  }, [draftStrokes]);

  const clearDraft = useCallback(() => setDraftStrokes({}), []);

  const clearObjects = useCallback(() => {
    setObjects((previous) => previous.filter((object) => object.kind === "planet" || object.kind === "star"));
    setInteraction((previous) => ({ ...previous, hoveredObjectId: null, selectedObjectId: null, grabbedObjectId: null, mode: "none" }));
  }, []);

  const resetSolar = useCallback(() => {
    setObjects(SOLAR_SYSTEM_OBJECTS.map((object) => ({ ...object })));
    setInteraction((previous) => ({ ...previous, hoveredObjectId: null, selectedObjectId: null, grabbedObjectId: null, mode: "none" }));
  }, []);

  useEffect(() => {
    if (mode === "draw") return;
    const pointer = gestures.primaryPoint;
    const pinch = gestures.primaryPinch;
    const secondaryPinch = gestures.secondaryPinch;
    const pinchDistance = gestures.pinchDistance;

    let hoveredObjectId: string | null = null;
    if (pointer) {
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const object of objects) {
        const distance = distance3D(pointer, object.position);
        const threshold = object.radius ? object.radius * 2.4 : 1.6;
        if (distance < threshold && distance < bestDistance) {
          bestDistance = distance;
          hoveredObjectId = object.id;
        }
      }
    }

    setInteraction((previous) => {
      let next = { ...previous, hoveredObjectId };

      if (pinch && hoveredObjectId && !previous.grabbedObjectId) {
        const targetObject = objects.find((object) => object.id === hoveredObjectId);
        if (targetObject && pointer) {
          grabbedOffsetRef.current = {
            x: targetObject.position.x - pointer.x,
            y: targetObject.position.y - pointer.y,
            z: targetObject.position.z - pointer.z,
          };
        }
        next = {
          ...next,
          selectedObjectId: hoveredObjectId,
          grabbedObjectId: hoveredObjectId,
          mode: "object",
        };
      } else if (!pinch && previous.grabbedObjectId) {
        grabbedOffsetRef.current = null;
        next = {
          ...next,
          grabbedObjectId: null,
          mode: "none",
        };
      } else if (!pinch && !secondaryPinch && previous.mode === "scene") {
        next = {
          ...next,
          mode: "none",
        };
      } else if (!previous.grabbedObjectId && pinch && secondaryPinch) {
        next = {
          ...next,
          mode: previous.selectedObjectId ? "object" : "scene",
        };
      }

      return next;
    });

    setObjects((previousObjects) =>
      previousObjects.map((object) => {
        const isHovered = object.id === hoveredObjectId;
        const isSelected = object.id === interaction.selectedObjectId || object.id === interaction.grabbedObjectId;
        const isGrabbed = object.id === interaction.grabbedObjectId && pinch;

        let nextObject: SpatialObject = {
          ...object,
          hovered: isHovered,
          selected: isSelected,
          grabbed: isGrabbed,
        };

        if (isGrabbed && pointer && grabbedOffsetRef.current) {
          const targetPosition = {
            x: pointer.x + grabbedOffsetRef.current.x,
            y: pointer.y + grabbedOffsetRef.current.y,
            z: pointer.z + grabbedOffsetRef.current.z,
          };
          nextObject = {
            ...nextObject,
            position: lerpPosition(nextObject.position, targetPosition, 0.22),
            rotation: {
              x: nextObject.rotation.x + ((pointer.y * 0.05) - nextObject.rotation.x) * 0.18,
              y: nextObject.rotation.y + ((pointer.x * 0.08) - nextObject.rotation.y) * 0.18,
              z: nextObject.rotation.z,
            },
          };
        }

        if (interaction.selectedObjectId === object.id && interaction.mode === "object" && pinch && secondaryPinch && pinchDistance) {
          if (!pinchScaleStartRef.current) pinchScaleStartRef.current = pinchDistance;
          const ratio = pinchDistance / pinchScaleStartRef.current;
          const nextScale = Math.max(0.2, Math.min(3.5, nextObject.scale.x * ratio));
          nextObject = {
            ...nextObject,
            scale: { x: nextScale, y: nextScale, z: nextScale },
          };
          pinchScaleStartRef.current = pinchDistance;
        }

        return nextObject;
      })
    );

    if (!(pinch && secondaryPinch)) {
      pinchScaleStartRef.current = null;
    }
  }, [gestures, interaction.grabbedObjectId, interaction.mode, interaction.selectedObjectId, mode, objects]);

  useEffect(() => {
    if (mode === "draw") return;
    if (interaction.mode !== "scene") return;
    if (!gestures.primaryPinch || !gestures.secondaryPinch || !gestures.pinchDistance) return;

    if (!pinchScaleStartRef.current) {
      pinchScaleStartRef.current = gestures.pinchDistance;
      return;
    }

    const ratio = gestures.pinchDistance / pinchScaleStartRef.current;
    pinchScaleStartRef.current = gestures.pinchDistance;

    setInteraction((previous) => ({
      ...previous,
      sceneScale: Math.max(0.65, Math.min(1.9, previous.sceneScale * ratio)),
      sceneZoom: Math.max(0.65, Math.min(1.8, previous.sceneZoom * ratio)),
    }));
  }, [gestures.pinchDistance, gestures.primaryPinch, gestures.secondaryPinch, interaction.mode, mode]);

  return {
    mode,
    setMode,
    objects,
    setObjects,
    gestures,
    draftStrokes,
    interaction,
    commitDrawing,
    clearDraft,
    clearObjects,
    resetSolar,
  };
}

function lerpPosition(current: Vec3Like, target: Vec3Like, alpha: number): Vec3Like {
  return {
    x: current.x + (target.x - current.x) * alpha,
    y: current.y + (target.y - current.y) * alpha,
    z: current.z + (target.z - current.z) * alpha,
  };
}

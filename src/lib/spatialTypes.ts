export type SpatialMode = "draw" | "spatial" | "solar";

export type SpatialObjectKind = "drawing" | "planet" | "star";
export type SpatialInteractionMode = "none" | "object" | "scene";

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface SpatialStrokePoint {
  x: number;
  y: number;
}

export interface SpatialDraftStroke {
  trackId: string;
  points: SpatialStrokePoint[];
  active: boolean;
}

export interface SpatialObject {
  id: string;
  kind: SpatialObjectKind;
  label: string;
  color: string;
  position: Vec3Like;
  rotation: Vec3Like;
  scale: Vec3Like;
  defaultPosition?: Vec3Like;
  defaultRotation?: Vec3Like;
  defaultScale?: Vec3Like;
  hovered: boolean;
  selected: boolean;
  grabbed: boolean;
  physicsEnabled: boolean;
  points?: SpatialStrokePoint[];
  radius?: number;
  orbitalRadius?: number;
  orbitalSpeed?: number;
}

export interface SpatialGestureState {
  primaryPinch: boolean;
  secondaryPinch: boolean;
  primaryPoint: Vec3Like | null;
  secondaryPoint: Vec3Like | null;
  pinchDistance: number | null;
  primaryTrackId: string | null;
  secondaryTrackId: string | null;
}

export interface SpatialInteractionState {
  hoveredObjectId: string | null;
  selectedObjectId: string | null;
  grabbedObjectId: string | null;
  mode: SpatialInteractionMode;
  sceneScale: number;
  sceneZoom: number;
}

// Gesture recognition from MediaPipe hand landmarks

export type GestureType =
  | "open_palm"
  | "fist"
  | "pointing"
  | "thumbs_up"
  | "thumbs_down"
  | "peace"
  | "swipe_left"
  | "swipe_right"
  | "none";

export interface GestureResult {
  gesture: GestureType;
  confidence: number;
  label: string;
  action: string;
  emoji: string;
}

export const GESTURE_MAP: Record<GestureType, { label: string; action: string; emoji: string }> = {
  open_palm: { label: "Open Palm", action: "Pause / Stop", emoji: "✋" },
  fist: { label: "Fist", action: "Grab / Hold", emoji: "✊" },
  pointing: { label: "Pointing", action: "Next Slide →", emoji: "👆" },
  thumbs_up: { label: "Thumbs Up", action: "Like / Approve", emoji: "👍" },
  thumbs_down: { label: "Thumbs Down", action: "Dislike", emoji: "👎" },
  peace: { label: "Peace / Victory", action: "Previous Slide ←", emoji: "✌️" },
  swipe_left: { label: "Swipe Left", action: "Next Slide →", emoji: "👈" },
  swipe_right: { label: "Swipe Right", action: "Previous Slide ←", emoji: "👉" },
  none: { label: "No Gesture", action: "—", emoji: "❓" },
};

type Landmark = { x: number; y: number; z: number };

function dist(a: Landmark, b: Landmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

function isFingerExtended(landmarks: Landmark[], fingerTip: number, fingerPip: number, wrist: number): boolean {
  const tipToWrist = dist(landmarks[fingerTip], landmarks[wrist]);
  const pipToWrist = dist(landmarks[fingerPip], landmarks[wrist]);
  return tipToWrist > pipToWrist * 1.1;
}

function isThumbExtended(landmarks: Landmark[]): boolean {
  // Thumb tip (4) should be farther from palm center than thumb IP (3)
  const palmCenter = landmarks[9]; // middle finger MCP as reference
  const tipDist = dist(landmarks[4], palmCenter);
  const ipDist = dist(landmarks[3], palmCenter);
  return tipDist > ipDist * 1.1;
}

export function classifyGesture(landmarks: Landmark[]): GestureResult {
  if (!landmarks || landmarks.length < 21) {
    return { gesture: "none", confidence: 0, ...GESTURE_MAP.none };
  }

  const wrist = 0;
  const thumb = isThumbExtended(landmarks);
  const index = isFingerExtended(landmarks, 8, 6, wrist);
  const middle = isFingerExtended(landmarks, 12, 10, wrist);
  const ring = isFingerExtended(landmarks, 16, 14, wrist);
  const pinky = isFingerExtended(landmarks, 20, 18, wrist);

  const extendedCount = [thumb, index, middle, ring, pinky].filter(Boolean).length;

  // Thumbs up: only thumb extended, hand oriented up
  if (thumb && !index && !middle && !ring && !pinky) {
    const thumbTip = landmarks[4];
    const thumbMcp = landmarks[2];
    if (thumbTip.y < thumbMcp.y - 0.05) {
      return { gesture: "thumbs_up", confidence: 0.85, ...GESTURE_MAP.thumbs_up };
    }
    if (thumbTip.y > thumbMcp.y + 0.05) {
      return { gesture: "thumbs_down", confidence: 0.85, ...GESTURE_MAP.thumbs_down };
    }
  }

  // Pointing: only index extended
  if (index && !middle && !ring && !pinky) {
    return { gesture: "pointing", confidence: 0.9, ...GESTURE_MAP.pointing };
  }

  // Peace: index + middle extended
  if (index && middle && !ring && !pinky) {
    return { gesture: "peace", confidence: 0.88, ...GESTURE_MAP.peace };
  }

  // Open palm: all fingers extended
  if (extendedCount >= 4) {
    return { gesture: "open_palm", confidence: 0.92, ...GESTURE_MAP.open_palm };
  }

  // Fist: no fingers extended
  if (extendedCount <= 1 && !index && !middle) {
    return { gesture: "fist", confidence: 0.87, ...GESTURE_MAP.fist };
  }

  return { gesture: "none", confidence: 0.3, ...GESTURE_MAP.none };
}

// Swipe detection via wrist position history
let positionHistory: { x: number; time: number }[] = [];

export function detectSwipe(landmarks: Landmark[]): GestureType | null {
  if (!landmarks || landmarks.length < 21) return null;

  const wrist = landmarks[0];
  const now = Date.now();
  positionHistory.push({ x: wrist.x, time: now });

  // Keep last 500ms
  positionHistory = positionHistory.filter((p) => now - p.time < 500);

  if (positionHistory.length < 5) return null;

  const first = positionHistory[0];
  const last = positionHistory[positionHistory.length - 1];
  const dx = last.x - first.x;
  const dt = last.time - first.time;

  if (dt < 100 || dt > 500) return null;

  // Note: webcam is mirrored, so left/right are flipped
  if (dx > 0.15) {
    positionHistory = [];
    return "swipe_left";
  }
  if (dx < -0.15) {
    positionHistory = [];
    return "swipe_right";
  }

  return null;
}

export function resetSwipeHistory() {
  positionHistory = [];
}

// Gesture recognition from MediaPipe hand landmarks

export type BuiltInGestureType =
  | "open_palm"
  | "fist"
  | "pointing"
  | "thumbs_up"
  | "thumbs_down"
  | "peace"
  | "rock"
  | "love_you"
  | "call_me"
  | "ok_sign"
  | "pinch"
  | "three"
  | "four"
  | "middle_finger"
  | "pinky_up"
  | "gun"
  | "vulcan"
  | "swipe_left"
  | "swipe_right"
  | "none";

export type GestureType = BuiltInGestureType | `custom_${string}`;

export interface GestureResult {
  gesture: GestureType;
  confidence: number;
  label: string;
  action: string;
  emoji: string;
}

export const GESTURE_MAP: Record<BuiltInGestureType, { label: string; action: string; emoji: string }> = {
  open_palm: { label: "Open Palm", action: "Pause / Stop", emoji: "✋" },
  fist: { label: "Fist", action: "Grab / Hold", emoji: "✊" },
  pointing: { label: "Point Up", action: "Next Slide →", emoji: "☝️" },
  thumbs_up: { label: "Thumbs Up", action: "Like / Approve", emoji: "👍" },
  thumbs_down: { label: "Thumbs Down", action: "Dislike", emoji: "👎" },
  peace: { label: "Peace / Victory", action: "Previous Slide ←", emoji: "✌️" },
  rock: { label: "Rock On", action: "Highlight", emoji: "🤘" },
  love_you: { label: "Love You", action: "React ❤️", emoji: "🤟" },
  call_me: { label: "Call Me / Shaka", action: "Hang Loose", emoji: "🤙" },
  ok_sign: { label: "OK Sign", action: "Confirm", emoji: "👌" },
  pinch: { label: "Pinch", action: "Zoom", emoji: "🤏" },
  three: { label: "Three", action: "Option 3", emoji: "🖖" },
  four: { label: "Four", action: "Option 4", emoji: "🖐️" },
  middle_finger: { label: "Middle Finger", action: "—", emoji: "🖕" },
  pinky_up: { label: "Pinky Up", action: "Fancy!", emoji: "🤙" },
  gun: { label: "Finger Gun", action: "Select / Shoot", emoji: "👉" },
  vulcan: { label: "Vulcan Salute", action: "Live Long 🖖", emoji: "🖖" },
  swipe_left: { label: "Swipe Left", action: "Next Slide →", emoji: "👈" },
  swipe_right: { label: "Swipe Right", action: "Previous Slide ←", emoji: "👉" },
  none: { label: "No Gesture", action: "—", emoji: "❓" },
};

type Landmark = { x: number; y: number; z: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function dist(a: Landmark, b: Landmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

// Robust-ish hand scale (normalized coords) used to make thresholds adaptive.
function handScale(landmarks: Landmark[]): number {
  const wristToMiddleMcp = dist(landmarks[0], landmarks[9]); // palm length proxy
  const indexMcpToPinkyMcp = dist(landmarks[5], landmarks[17]); // palm width proxy
  const scale = (wristToMiddleMcp + indexMcpToPinkyMcp) / 2;
  return Math.max(scale, 1e-6);
}

function angleDeg(a: Landmark, b: Landmark, c: Landmark): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const abz = a.z - b.z;

  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const cbz = c.z - b.z;

  const dot = abx * cbx + aby * cby + abz * cbz;
  const abMag = Math.sqrt(abx * abx + aby * aby + abz * abz);
  const cbMag = Math.sqrt(cbx * cbx + cby * cby + cbz * cbz);
  if (abMag < 1e-6 || cbMag < 1e-6) return 0;
  const cos = clamp(dot / (abMag * cbMag), -1, 1);
  return (Math.acos(cos) * 180) / Math.PI;
}

function isFingerExtended(
  landmarks: Landmark[],
  fingerTip: number,
  fingerPip: number,
  fingerMcp: number,
  wrist: number
): boolean {
  // Hybrid test: distance-to-wrist (stable) + joint straightness (reduces false positives when curled).
  const tipToWrist = dist(landmarks[fingerTip], landmarks[wrist]);
  const pipToWrist = dist(landmarks[fingerPip], landmarks[wrist]);

  const lengthOk = tipToWrist > pipToWrist * 1.08;
  const straightOk = angleDeg(landmarks[fingerMcp], landmarks[fingerPip], landmarks[fingerTip]) > 160;

  // Allow a stronger distance signal to pass even when angle is noisy (common under occlusion).
  const strongLengthOk = tipToWrist > pipToWrist * 1.18;

  return (lengthOk && straightOk) || strongLengthOk;
}

function isThumbExtended(landmarks: Landmark[]): boolean {
  const scale = handScale(landmarks);
  const palmCenter = landmarks[9];

  const tipDist = dist(landmarks[4], palmCenter);
  const ipDist = dist(landmarks[3], palmCenter);
  const awayFromPalm = tipDist > ipDist * 1.06;

  const thumbStraight = angleDeg(landmarks[2], landmarks[3], landmarks[4]) > 150;

  // If thumb is very close to index tip, it's likely a pinch/OK rather than "extended".
  const thumbIndexGap = dist(landmarks[4], landmarks[8]);
  const notPinched = thumbIndexGap > scale * 0.28;

  return awayFromPalm && (thumbStraight || notPinched);
}

// Check if two tips are close (for OK / pinch). Threshold is relative to hand size.
function tipsTouching(
  landmarks: Landmark[],
  tipA: number,
  tipB: number
): { touching: boolean; closeness: number } {
  const scale = handScale(landmarks);
  const threshold = scale * 0.35;
  const d = dist(landmarks[tipA], landmarks[tipB]);
  const closeness = clamp01(1 - d / threshold);
  return { touching: d < threshold, closeness };
}

export function classifyGesture(landmarks: Landmark[]): GestureResult {
  if (!landmarks || landmarks.length < 21) {
    return { gesture: "none", confidence: 0, ...GESTURE_MAP.none };
  }

  const wrist = 0;
  const scale = handScale(landmarks);
  const palmCenter = landmarks[9];

  const thumb = isThumbExtended(landmarks);
  const index = isFingerExtended(landmarks, 8, 6, 5, wrist);
  const middle = isFingerExtended(landmarks, 12, 10, 9, wrist);
  const ring = isFingerExtended(landmarks, 16, 14, 13, wrist);
  const pinky = isFingerExtended(landmarks, 20, 18, 17, wrist);

  const extendedCount = [thumb, index, middle, ring, pinky].filter(Boolean).length;
  const { touching: thumbIndexTouching, closeness: thumbIndexCloseness } = tipsTouching(landmarks, 4, 8);

  // --- Priority-ordered classification ---

  // OK Sign: thumb + index tips touching, at least one other finger extended
  if (thumbIndexTouching && (middle || ring || pinky)) {
    const conf = 0.78 + 0.18 * thumbIndexCloseness + 0.05 * clamp01((extendedCount - 2) / 3);
    return { gesture: "ok_sign", confidence: +conf.toFixed(2), ...GESTURE_MAP.ok_sign };
  }

  // Pinch: thumb + index tips touching, other fingers curled
  if (thumbIndexTouching && !middle && !ring && !pinky) {
    const conf = 0.75 + 0.2 * thumbIndexCloseness;
    return { gesture: "pinch", confidence: +conf.toFixed(2), ...GESTURE_MAP.pinch };
  }

  // Thumbs up/down: only thumb extended (direction uses an adaptive threshold)
  if (thumb && !index && !middle && !ring && !pinky) {
    const thumbTip = landmarks[4];
    const thumbMcp = landmarks[2];
    const yThresh = scale * 0.25;
    if (thumbTip.y < thumbMcp.y - yThresh) {
      return { gesture: "thumbs_up", confidence: 0.85, ...GESTURE_MAP.thumbs_up };
    }
    if (thumbTip.y > thumbMcp.y + yThresh) {
      return { gesture: "thumbs_down", confidence: 0.85, ...GESTURE_MAP.thumbs_down };
    }
  }

  // Rock On 🤘: index + pinky extended, middle + ring curled
  if (index && !middle && !ring && pinky && !thumb) {
    return { gesture: "rock", confidence: 0.87, ...GESTURE_MAP.rock };
  }

  // Love You 🤟: thumb + index + pinky extended, middle + ring curled
  if (thumb && index && !middle && !ring && pinky) {
    return { gesture: "love_you", confidence: 0.86, ...GESTURE_MAP.love_you };
  }

  // Call Me / Shaka 🤙: thumb + pinky extended, others curled
  if (thumb && !index && !middle && !ring && pinky) {
    return { gesture: "call_me", confidence: 0.85, ...GESTURE_MAP.call_me };
  }

  // Finger Gun 👉: thumb + index extended, others curled
  if (thumb && index && !middle && !ring && !pinky) {
    return { gesture: "gun", confidence: 0.84, ...GESTURE_MAP.gun };
  }

  // Pointing ☝️: index extended, others curled; allow a relaxed thumb to reduce "gun" false positives.
  const thumbRelaxed = dist(landmarks[4], palmCenter) < scale * 0.75;
  if (index && !middle && !ring && !pinky && (!thumb || thumbRelaxed)) {
    return { gesture: "pointing", confidence: 0.9, ...GESTURE_MAP.pointing };
  }

  // Middle Finger 🖕: only middle extended
  if (!thumb && !index && middle && !ring && !pinky) {
    return { gesture: "middle_finger", confidence: 0.85, ...GESTURE_MAP.middle_finger };
  }

  // Pinky Up: only pinky extended
  if (!thumb && !index && !middle && !ring && pinky) {
    return { gesture: "pinky_up", confidence: 0.83, ...GESTURE_MAP.pinky_up };
  }

  // Peace ✌️: index + middle extended, others curled
  if (index && middle && !ring && !pinky) {
    return { gesture: "peace", confidence: 0.88, ...GESTURE_MAP.peace };
  }

  // Three: index + middle + ring extended
  if (index && middle && ring && !pinky) {
    return { gesture: "three", confidence: 0.84, ...GESTURE_MAP.three };
  }

  // Four: index + middle + ring + pinky (no thumb)
  if (!thumb && index && middle && ring && pinky) {
    return { gesture: "four", confidence: 0.83, ...GESTURE_MAP.four };
  }

  // Vulcan Salute 🖖: all fingers extended with a gap between middle and ring
  if (extendedCount >= 4 && index && middle && ring && pinky) {
    const middleRingGap = dist(landmarks[12], landmarks[16]);
    const indexMiddleGap = dist(landmarks[8], landmarks[12]);
    if (middleRingGap > indexMiddleGap * 1.4) {
      return { gesture: "vulcan", confidence: 0.82, ...GESTURE_MAP.vulcan };
    }
  }

  // Open palm ✋: all fingers extended and tips away from the palm center
  const openFingers = [8, 12, 16, 20].every((tip) => dist(landmarks[tip], palmCenter) > scale * 0.85);
  if (extendedCount >= 4 && openFingers) {
    return { gesture: "open_palm", confidence: 0.92, ...GESTURE_MAP.open_palm };
  }

  // Fist ✊: all finger tips close to palm center (more robust than "extendedCount" alone)
  const curledTips = [8, 12, 16, 20].every((tip) => dist(landmarks[tip], palmCenter) < scale * 0.6);
  if (!index && !middle && !ring && !pinky && curledTips) {
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

  positionHistory = positionHistory.filter((p) => now - p.time < 500);

  if (positionHistory.length < 5) return null;

  const first = positionHistory[0];
  const last = positionHistory[positionHistory.length - 1];
  const dx = last.x - first.x;
  const dt = last.time - first.time;

  if (dt < 100 || dt > 500) return null;

  // NOTE: These directions are kept as-is because the UI uses a mirrored camera view.
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


// Gesture recognition from MediaPipe hand landmarks

export type GestureType =
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

export interface GestureResult {
  gesture: GestureType;
  confidence: number;
  label: string;
  action: string;
  emoji: string;
}

export const GESTURE_MAP: Record<GestureType, { label: string; action: string; emoji: string }> = {
  open_palm:    { label: "Open Palm",       action: "Pause / Stop",       emoji: "✋" },
  fist:         { label: "Fist",            action: "Grab / Hold",        emoji: "✊" },
  pointing:     { label: "Point Up",        action: "Next Slide →",       emoji: "☝️" },
  thumbs_up:    { label: "Thumbs Up",       action: "Like / Approve",     emoji: "👍" },
  thumbs_down:  { label: "Thumbs Down",     action: "Dislike",            emoji: "👎" },
  peace:        { label: "Peace / Victory",  action: "Previous Slide ←",  emoji: "✌️" },
  rock:         { label: "Rock On",         action: "Highlight",          emoji: "🤘" },
  love_you:     { label: "Love You",        action: "React ❤️",           emoji: "🤟" },
  call_me:      { label: "Call Me / Shaka", action: "Hang Loose",         emoji: "🤙" },
  ok_sign:      { label: "OK Sign",         action: "Confirm",            emoji: "👌" },
  pinch:        { label: "Pinch",           action: "Zoom",               emoji: "🤏" },
  three:        { label: "Three",           action: "Option 3",           emoji: "🖖" },
  four:         { label: "Four",            action: "Option 4",           emoji: "🖐️" },
  middle_finger:{ label: "Middle Finger",   action: "—",                  emoji: "🖕" },
  pinky_up:     { label: "Pinky Up",        action: "Fancy!",             emoji: "🤙" },
  gun:          { label: "Finger Gun",      action: "Select / Shoot",     emoji: "👈" },
  vulcan:       { label: "Vulcan Salute",   action: "Live Long 🖖",      emoji: "🖖" },
  swipe_left:   { label: "Swipe Left",      action: "Next Slide →",       emoji: "👈" },
  swipe_right:  { label: "Swipe Right",     action: "Previous Slide ←",   emoji: "👉" },
  none:         { label: "No Gesture",      action: "—",                  emoji: "❓" },
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
  const palmCenter = landmarks[9];
  const tipDist = dist(landmarks[4], palmCenter);
  const ipDist = dist(landmarks[3], palmCenter);
  return tipDist > ipDist * 1.1;
}

// Check if thumb tip and index tip are close (for OK / pinch)
function areTipsTouching(landmarks: Landmark[], tipA: number, tipB: number, threshold = 0.06): boolean {
  return dist(landmarks[tipA], landmarks[tipB]) < threshold;
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
  const thumbIndexTouching = areTipsTouching(landmarks, 4, 8);

  // --- Priority-ordered classification ---

  // OK Sign: thumb + index tips touching, other fingers extended
  if (thumbIndexTouching && middle && ring) {
    return { gesture: "ok_sign", confidence: 0.88, ...GESTURE_MAP.ok_sign };
  }

  // Pinch: thumb + index tips touching, other fingers curled
  if (thumbIndexTouching && !middle && !ring) {
    return { gesture: "pinch", confidence: 0.85, ...GESTURE_MAP.pinch };
  }

  // Thumbs up/down: only thumb extended
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

  // Finger Gun 👈: thumb + index extended, others curled
  if (thumb && index && !middle && !ring && !pinky) {
    return { gesture: "gun", confidence: 0.84, ...GESTURE_MAP.gun };
  }

  // Pointing ☝️: only index extended (no thumb)
  if (!thumb && index && !middle && !ring && !pinky) {
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

  // Open palm ✋: all fingers extended
  if (extendedCount >= 4) {
    return { gesture: "open_palm", confidence: 0.92, ...GESTURE_MAP.open_palm };
  }

  // Fist ✊: no fingers extended
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

  positionHistory = positionHistory.filter((p) => now - p.time < 500);

  if (positionHistory.length < 5) return null;

  const first = positionHistory[0];
  const last = positionHistory[positionHistory.length - 1];
  const dx = last.x - first.x;
  const dt = last.time - first.time;

  if (dt < 100 || dt > 500) return null;

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

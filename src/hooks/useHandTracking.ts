import { useEffect, useRef, useState, useCallback } from "react";
import { classifyGesture, detectSwipe, resetSwipeHistory, type GestureResult, type GestureType } from "@/lib/gestures";
import type { TrackingPreferences } from "@/hooks/useTrackingPreferences";
import { matchCustomGesture, type CustomGestureProfile } from "@/lib/customGestures";

type Hands = any;
type Results = any;

const MEDIAPIPE_VERSION = "0.4.1675469240";
const CDN_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${MEDIAPIPE_VERSION}`;

let handsRuntimePromise: Promise<new (config: any) => any> | null = null;

function loadHandsRuntime(): Promise<new (config: any) => any> {
  if (handsRuntimePromise) return handsRuntimePromise;

  handsRuntimePromise = new Promise((resolve, reject) => {
    // If already loaded globally (e.g. from a previous session)
    if ((window as any).Hands) {
      resolve((window as any).Hands);
      return;
    }

    const script = document.createElement("script");
    script.src = `${CDN_BASE}/hands.js`;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      const Ctor = (window as any).Hands;
      if (Ctor) {
        console.log("[HandTracking] MediaPipe Hands loaded from CDN");
        resolve(Ctor);
      } else {
        handsRuntimePromise = null;
        reject(new Error("MediaPipe Hands script loaded but global constructor not found"));
      }
    };
    script.onerror = () => {
      handsRuntimePromise = null;
      reject(new Error("Failed to load MediaPipe Hands script from CDN"));
    };
    document.head.appendChild(script);
  });

  return handsRuntimePromise;
}

export interface HandData {
  landmarks: any[];
  gesture: GestureResult;
  handedness: string;
  handednessConfidence: number;
}

export interface StringMeasurement {
  from: number;
  to: number;
  cm: number;
}

export interface HandTrackingState {
  isLoading: boolean;
  isActive: boolean;
  trackingReady: boolean;
  error: string | null;
  gesture: GestureResult | null;
  landmarks: any[] | null;
  hands: HandData[];
  fps: number;
  writingTip: { x: number; y: number } | null;
  isWriting: boolean;
  stringMeasurements: StringMeasurement[];
}

export interface HandTrackingCalibrationState {
  baselineReferencePx: number | null;
  currentReferencePx: number | null;
  effectiveDistanceFactor: number;
}

const CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

const HAND_COLORS: Record<string, { line: string; dot: string; tip: string }> = {
  Left: {
    line: "hsl(187, 100%, 50%)",
    dot: "hsl(187, 100%, 50%)",
    tip: "hsl(270, 80%, 60%)",
  },
  Right: {
    line: "hsl(150, 80%, 50%)",
    dot: "hsl(150, 80%, 50%)",
    tip: "hsl(40, 90%, 55%)",
  },
};

const DEFAULT_TUNING: TrackingPreferences = {
  handReferenceCm: 8.5,
  cameraDistanceFactor: 1,
  gestureConfidenceThreshold: 0.6,
  actionDebounceMs: 1200,
  handednessConfidenceThreshold: 0.75,
  handednessDebounceMs: 220,
};

const NO_GESTURE: GestureResult = {
  gesture: "none",
  confidence: 0,
  label: "No Gesture",
  action: "-",
  emoji: "?",
};

type HandednessLabel = "Left" | "Right";

interface HandednessSmoothingState {
  stable: HandednessLabel;
  candidate: HandednessLabel | null;
  candidateSince: number;
}

function inferHandednessFromLandmarks(landmarks: any[]): { label: HandednessLabel; confidence: number } {
  const thumb = landmarks[4];
  const pinkyMcp = landmarks[17];
  if (!thumb || !pinkyMcp) return { label: "Right", confidence: 0.5 };

  const delta = thumb.x - pinkyMcp.x;
  const confidence = Math.min(1, Math.max(0.5, 0.5 + Math.abs(delta)));
  return {
    label: delta <= 0 ? "Right" : "Left",
    confidence,
  };
}

function isFingerUp(landmarks: any[], tip: number, pip: number, wrist: number): boolean {
  const tipD = Math.sqrt(
    (landmarks[tip].x - landmarks[wrist].x) ** 2 +
    (landmarks[tip].y - landmarks[wrist].y) ** 2
  );
  const pipD = Math.sqrt(
    (landmarks[pip].x - landmarks[wrist].x) ** 2 +
    (landmarks[pip].y - landmarks[wrist].y) ** 2
  );
  return tipD > pipD * 1.1;
}

function isWritingPose(landmarks: any[]): boolean {
  const index = isFingerUp(landmarks, 8, 6, 0);
  const middle = isFingerUp(landmarks, 12, 10, 0);
  const ring = isFingerUp(landmarks, 16, 14, 0);
  const pinky = isFingerUp(landmarks, 20, 18, 0);
  return index && !middle && !ring && !pinky;
}

const STRING_COLORS = [
  "hsl(0, 100%, 65%)",
  "hsl(45, 100%, 60%)",
  "hsl(120, 80%, 55%)",
  "hsl(200, 100%, 60%)",
  "hsl(280, 80%, 65%)",
  "hsl(330, 90%, 60%)",
];

const CALIBRATION_STORAGE_KEY = "gesture-presenter-calibration-baseline-px";

async function createAndInitHands(
  locateFile: (file: string) => string,
  onResults: (results: Results) => void,
  useCpu: boolean,
  timeoutMs: number
): Promise<Hands> {
  const HandsConstructor = await loadHandsRuntime();
  const hands = new HandsConstructor({ locateFile });

  const options: any = {
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5,
  };
  if (useCpu) {
    options.useCpuInference = true;
  }
  hands.setOptions(options);
  hands.onResults(onResults);

  // Initialize with timeout
  await Promise.race([
    hands.initialize(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("MediaPipe initialization timed out")), timeoutMs)
    ),
  ]);

  return hands;
}

export function useHandTracking(
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onGestureAction?: (gesture: GestureType) => void,
  drawOverlayRef?: React.MutableRefObject<boolean>,
  drawStringRef?: React.MutableRefObject<boolean>,
  drawMeasureRef?: React.MutableRefObject<boolean>,
  tuning?: Partial<TrackingPreferences>,
  customGestureProfiles: CustomGestureProfile[] = []
) {
  const [state, setState] = useState<HandTrackingState>({
    isLoading: false,
    isActive: false,
    trackingReady: false,
    error: null,
    gesture: null,
    landmarks: null,
    hands: [],
    fps: 0,
    writingTip: null,
    isWriting: false,
    stringMeasurements: [],
  });

  const cameraRef = useRef<{ stop: () => void } | null>(null);
  const handsRef = useRef<Hands | null>(null);
  const frameCountRef = useRef(0);
  const lastFpsTime = useRef(Date.now());
  const lastActionTime = useRef(0);
  const gestureActionRef = useRef(onGestureAction);
  gestureActionRef.current = onGestureAction;
  const tuningRef = useRef<TrackingPreferences>({ ...DEFAULT_TUNING, ...(tuning ?? {}) });
  tuningRef.current = { ...DEFAULT_TUNING, ...(tuning ?? {}) };
  const handednessStateRef = useRef<Record<number, HandednessSmoothingState>>({});
  const [calibration, setCalibration] = useState<HandTrackingCalibrationState>({
    baselineReferencePx: null,
    currentReferencePx: null,
    effectiveDistanceFactor: 1,
  });
  const baselineReferencePxRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CALIBRATION_STORAGE_KEY);
      if (!stored) return;
      const parsed = Number(stored);
      if (!Number.isFinite(parsed) || parsed <= 0) return;
      baselineReferencePxRef.current = parsed;
      setCalibration((prev) => ({ ...prev, baselineReferencePx: parsed }));
    } catch {
      // ignore storage hydration failures
    }
  }, []);

  const resolveHandedness = useCallback(
    (
      handIndex: number,
      landmarks: any[],
      modelLabel: string | undefined,
      modelScore: number | undefined,
      timestamp: number
    ): { label: HandednessLabel; confidence: number } => {
      const tuned = tuningRef.current;
      const modelResolved: HandednessLabel | null =
        modelLabel === "Left" || modelLabel === "Right" ? modelLabel : null;
      const modelConfidence = typeof modelScore === "number" ? modelScore : 0;
      const inferred = inferHandednessFromLandmarks(landmarks);
      const candidateLabel =
        modelResolved && modelConfidence >= tuned.handednessConfidenceThreshold
          ? modelResolved
          : inferred.label;
      const candidateConfidence =
        modelResolved && candidateLabel === modelResolved ? modelConfidence : inferred.confidence;

      const previous = handednessStateRef.current[handIndex];
      if (!previous) {
        handednessStateRef.current[handIndex] = {
          stable: candidateLabel,
          candidate: null,
          candidateSince: timestamp,
        };
        return { label: candidateLabel, confidence: candidateConfidence };
      }

      if (candidateLabel === previous.stable) {
        previous.candidate = null;
        previous.candidateSince = timestamp;
        return { label: previous.stable, confidence: candidateConfidence };
      }

      if (previous.candidate === candidateLabel) {
        if (timestamp - previous.candidateSince >= tuned.handednessDebounceMs) {
          previous.stable = candidateLabel;
          previous.candidate = null;
          previous.candidateSince = timestamp;
        }
      } else {
        previous.candidate = candidateLabel;
        previous.candidateSince = timestamp;
      }

      return { label: previous.stable, confidence: candidateConfidence };
    },
    []
  );

  // Gesture stabilization to reduce frame-to-frame flicker (jitter/partial occlusion).
  const stableGestureRef = useRef<GestureResult | null>(null);
  const candidateGestureRef = useRef<{ gesture: GestureResult; frames: number } | null>(null);
  const noneFramesRef = useRef(0);

  const stabilizeGesture = useCallback((observed: GestureResult | null): GestureResult | null => {
    if (!observed) {
      stableGestureRef.current = null;
      candidateGestureRef.current = null;
      noneFramesRef.current = 0;
      return null;
    }

    // Swipes are already time-aggregated; don't delay them.
    if (observed.gesture === "swipe_left" || observed.gesture === "swipe_right") {
      stableGestureRef.current = observed;
      candidateGestureRef.current = null;
      noneFramesRef.current = 0;
      return observed;
    }

    const MIN_CONFIDENCE = 0.7;
    const STABLE_FRAMES = 3;
    const CLEAR_FRAMES = 2;

    const isUsable = observed.gesture !== "none" && observed.confidence >= MIN_CONFIDENCE;
    if (!isUsable) {
      candidateGestureRef.current = null;
      noneFramesRef.current += 1;
      if (noneFramesRef.current >= CLEAR_FRAMES) {
        stableGestureRef.current = null;
      }
      return stableGestureRef.current;
    }

    noneFramesRef.current = 0;

    const stable = stableGestureRef.current;
    if (stable && stable.gesture === observed.gesture) {
      // Keep stable gesture updated with freshest confidence/label.
      stableGestureRef.current = observed;
      candidateGestureRef.current = null;
      return observed;
    }

    const candidate = candidateGestureRef.current;
    if (!candidate || candidate.gesture.gesture !== observed.gesture) {
      candidateGestureRef.current = { gesture: observed, frames: 1 };
      return stableGestureRef.current;
    }

    candidate.frames += 1;
    if (candidate.frames >= STABLE_FRAMES) {
      stableGestureRef.current = candidate.gesture;
      candidateGestureRef.current = null;
    }

    return stableGestureRef.current;
  }, []);

  // Landmark smoothing (EMA) per handedness to reduce jitter before classification/drawing.
  const smoothedLandmarksRef = useRef<Record<string, { x: number; y: number; z: number }[] | null>>({
    Left: null,
    Right: null,
  });

  const smoothLandmarks = useCallback((raw: any[], key: string) => {
    const prev = smoothedLandmarksRef.current[key];
    const alpha = 0.55; // higher = less lag, lower = smoother

    if (!prev || prev.length !== raw.length) {
      const seeded = raw.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 }));
      smoothedLandmarksRef.current[key] = seeded;
      return seeded;
    }

    const next = raw.map((p, i) => ({
      x: prev[i].x + alpha * (p.x - prev[i].x),
      y: prev[i].y + alpha * (p.y - prev[i].y),
      z: prev[i].z + alpha * ((p.z ?? 0) - prev[i].z),
    }));

    smoothedLandmarksRef.current[key] = next;
    return next;
  }, []);

  const start = useCallback(async () => {
    setState((s) => ({ ...s, error: null, isLoading: true, trackingReady: false }));

    if (!videoRef.current || !canvasRef.current) {
      setState((s) => ({ ...s, isLoading: false, isActive: false, error: "Camera elements not ready. Please try again." }));
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setState((s) => ({ ...s, isLoading: false, isActive: false, error: "Camera requires a secure (HTTPS) connection. Please use the published URL or localhost." }));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    } catch (err: any) {
      const msg = err?.name === "NotAllowedError"
        ? "Camera access denied. Please allow camera permission in your browser settings."
        : err?.name === "NotFoundError"
        ? "No camera found. Please connect a camera and try again."
        : `Camera error: ${err?.message || "Unknown error"}`;
      console.error("Camera access failed:", err);
      setState((s) => ({ ...s, isLoading: false, isActive: false, error: msg }));
      return;
    }

    // Camera feed is live
    setState((s) => ({ ...s, isLoading: false, isActive: true }));

    const locateFile = (file: string) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${MEDIAPIPE_VERSION}/${file}`;

    const onResults = (results: Results) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      frameCountRef.current++;
      const now = Date.now();
      if (now - lastFpsTime.current >= 1000) {
        const fps = frameCountRef.current;
        frameCountRef.current = 0;
        lastFpsTime.current = now;
        setState((s) => ({ ...s, fps }));
      }

      const handCount = results.multiHandLandmarks?.length || 0;
      const tuned = tuningRef.current;

      if (handCount > 0) {
        const handsData: HandData[] = [];
        let primaryGesture: GestureResult | null = null;
        let writingTip: { x: number; y: number } | null = null;
        let isWriting = false;

        for (let h = 0; h < handCount; h++) {
          const rawLandmarks = results.multiHandLandmarks[h];
          const modelHandedness = results.multiHandedness?.[h];
          const resolvedHandedness = resolveHandedness(
            h,
            rawLandmarks as any,
            modelHandedness?.label,
            modelHandedness?.score,
            now
          );
          const handedness = resolvedHandedness.label;
          const landmarks = smoothLandmarks(rawLandmarks as any, handedness);
          const colors = HAND_COLORS[handedness] || HAND_COLORS.Right;

          const shouldDraw = drawOverlayRef ? drawOverlayRef.current : true;

          if (shouldDraw) {
            ctx.strokeStyle = colors.line;
            ctx.lineWidth = 2;
            ctx.shadowColor = colors.line;
            ctx.shadowBlur = 8;

            for (const [i, j] of CONNECTIONS) {
              const a = landmarks[i];
              const b = landmarks[j];
              ctx.beginPath();
              ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
              ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
              ctx.stroke();
            }

            for (let i = 0; i < landmarks.length; i++) {
              const lm = landmarks[i];
              const x = lm.x * canvas.width;
              const y = lm.y * canvas.height;
              const isTip = [4, 8, 12, 16, 20].includes(i);

              ctx.beginPath();
              ctx.arc(x, y, isTip ? 6 : 3, 0, 2 * Math.PI);
              ctx.fillStyle = isTip ? colors.tip : colors.dot;
              ctx.shadowColor = isTip ? colors.tip : colors.dot;
              ctx.shadowBlur = isTip ? 15 : 8;
              ctx.fill();
            }

            ctx.shadowBlur = 0;
          }

          const builtInGesture = classifyGesture(landmarks as any);
          const customGesture = matchCustomGesture(landmarks as any, customGestureProfiles);
          const gesture =
            customGesture && customGesture.confidence > builtInGesture.confidence
              ? customGesture
              : builtInGesture;
          handsData.push({
            landmarks: landmarks as any,
            gesture,
            handedness,
            handednessConfidence: resolvedHandedness.confidence,
          });

          if (isWritingPose(landmarks as any)) {
            const indexTip = landmarks[8];
            writingTip = { x: indexTip.x, y: indexTip.y };
            isWriting = true;

            ctx.beginPath();
            ctx.arc(indexTip.x * canvas.width, indexTip.y * canvas.height, 12, 0, 2 * Math.PI);
            ctx.strokeStyle = "hsl(0, 100%, 60%)";
            ctx.lineWidth = 2;
            ctx.shadowColor = "hsl(0, 100%, 60%)";
            ctx.shadowBlur = 15;
            ctx.stroke();
            ctx.shadowBlur = 0;
          }

          if (!primaryGesture || gesture.confidence > primaryGesture.confidence) {
            primaryGesture = gesture;
          }
        }

        // Draw finger strings with distance measurement
        const shouldDrawStrings = drawStringRef ? drawStringRef.current : false;
        const measurements: StringMeasurement[] = [];
        if (shouldDrawStrings) {
          const allTips: { x: number; y: number; idx: number }[] = [];
          const fingerChecks: [number, number][] = [[4, 3], [8, 6], [12, 10], [16, 14], [20, 18]];
          for (const hand of handsData) {
            for (const [tip, pip] of fingerChecks) {
              if (isFingerUp(hand.landmarks, tip, pip, 0)) {
                const lm = hand.landmarks[tip];
                allTips.push({ x: lm.x * canvas.width, y: lm.y * canvas.height, idx: tip });
              }
            }
          }

          // Calibration: wrist(0) to middle MCP(9) ≈ 8.5 cm
          const refHand = handsData[0].landmarks;
          const wrist = refHand[0];
          const mcp9 = refHand[9];
          const refPx = Math.sqrt(
            ((wrist.x - mcp9.x) * canvas.width) ** 2 +
            ((wrist.y - mcp9.y) * canvas.height) ** 2
          );
          const baselinePx = baselineReferencePxRef.current;
          const autoDistanceFactor =
            baselinePx && refPx > 0 ? Math.min(1.6, Math.max(0.65, baselinePx / refPx)) : 1;
          const effectiveDistanceFactor = tuned.cameraDistanceFactor * autoDistanceFactor;
          const cmPerPx = refPx > 0 ? (tuned.handReferenceCm / refPx) * effectiveDistanceFactor : 0;

          if (allTips.length >= 2) {
            ctx.lineWidth = 2;
            ctx.shadowBlur = 12;

            for (let i = 0; i < allTips.length; i++) {
              for (let j = i + 1; j < allTips.length; j++) {
                const color = STRING_COLORS[(i + j) % STRING_COLORS.length];
                ctx.strokeStyle = color;
                ctx.shadowColor = color;
                ctx.globalAlpha = 0.7;
                ctx.beginPath();
                ctx.moveTo(allTips[i].x, allTips[i].y);
                ctx.lineTo(allTips[j].x, allTips[j].y);
                ctx.stroke();

                // Distance label
                const shouldMeasure = drawMeasureRef ? drawMeasureRef.current : true;
                const dx = allTips[j].x - allTips[i].x;
                const dy = allTips[j].y - allTips[i].y;
                const pxDist = Math.sqrt(dx * dx + dy * dy);
                const cmDist = +(pxDist * cmPerPx).toFixed(1);
                const mx = (allTips[i].x + allTips[j].x) / 2;
                const my = (allTips[i].y + allTips[j].y) / 2;

                measurements.push({ from: allTips[i].idx, to: allTips[j].idx, cm: cmDist });

                if (shouldMeasure) {
                  // Draw pill + text flipped so it reads correctly on mirrored canvas
                  ctx.globalAlpha = 1;
                  ctx.shadowBlur = 0;
                  const label = `${cmDist} cm`;
                  ctx.font = "bold 13px sans-serif";
                  const tw = ctx.measureText(label).width;
                  const pw = tw + 12;
                  const ph = 20;

                  ctx.save();
                  ctx.translate(mx, my);
                  ctx.scale(-1, 1); // flip horizontally to counter CSS mirror

                  ctx.fillStyle = "rgba(0,0,0,0.7)";
                  ctx.beginPath();
                  ctx.roundRect(-pw / 2, -ph / 2, pw, ph, 6);
                  ctx.fill();

                  ctx.fillStyle = "#fff";
                  ctx.textAlign = "center";
                  ctx.textBaseline = "middle";
                  ctx.fillText(label, 0, 0);
                  ctx.restore();
                }
              }
            }
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
          }
        }

        const swipe = detectSwipe(handsData[0].landmarks);
        const rawFinalGesture = swipe
          ? {
              gesture: swipe,
              confidence: 0.8,
              label: swipe === "swipe_left" ? "Swipe Left" : "Swipe Right",
              action: swipe === "swipe_left" ? "Next Slide ->" : "Previous Slide <-",
              emoji: swipe === "swipe_left" ? "<-" : "->",
            }
          : primaryGesture;
        const finalGesture =
          rawFinalGesture && rawFinalGesture.confidence >= tuned.gestureConfidenceThreshold
            ? rawFinalGesture
            : NO_GESTURE;

        const stabilizedGesture = stabilizeGesture(finalGesture);

        setState((s) => ({
          ...s,
          gesture: stabilizedGesture,
          landmarks: handsData[0].landmarks,
          hands: handsData,
          writingTip: isWriting ? writingTip : null,
          isWriting,
          stringMeasurements: measurements,
        }));

        const refHandForCalibration = handsData[0]?.landmarks;
        if (refHandForCalibration?.[0] && refHandForCalibration?.[9]) {
          const refPxForCalibration = Math.sqrt(
            ((refHandForCalibration[0].x - refHandForCalibration[9].x) * canvas.width) ** 2 +
            ((refHandForCalibration[0].y - refHandForCalibration[9].y) * canvas.height) ** 2
          );
          const baselinePx = baselineReferencePxRef.current;
          const autoDistanceFactor =
            baselinePx && refPxForCalibration > 0
              ? Math.min(1.6, Math.max(0.65, baselinePx / refPxForCalibration))
              : 1;
          setCalibration({
            baselineReferencePx: baselinePx,
            currentReferencePx: refPxForCalibration,
            effectiveDistanceFactor: Number((tuned.cameraDistanceFactor * autoDistanceFactor).toFixed(2)),
          });
        }

        if (
          stabilizedGesture &&
          stabilizedGesture.gesture !== "none" &&
          !isWriting &&
          now - lastActionTime.current > tuned.actionDebounceMs
        ) {
          lastActionTime.current = now;
          gestureActionRef.current?.(stabilizedGesture.gesture);
        }
      } else {
        stableGestureRef.current = null;
        candidateGestureRef.current = null;
        noneFramesRef.current = 0;
        smoothedLandmarksRef.current.Left = null;
        smoothedLandmarksRef.current.Right = null;
        setState((s) => ({
          ...s,
          gesture: null,
          landmarks: null,
          hands: [],
          writingTip: null,
          isWriting: false,
        }));
        setCalibration((prev) => ({
          ...prev,
          currentReferencePx: null,
          effectiveDistanceFactor: Number(tuningRef.current.cameraDistanceFactor.toFixed(2)),
        }));
      }
    };

    // Try GPU first, fallback to CPU
    let hands: Hands | null = null;
    try {
      console.log("Initializing MediaPipe Hands (GPU mode)...");
      hands = await createAndInitHands(locateFile, onResults, false, 15000);
      console.log("MediaPipe Hands initialized successfully (GPU)");
    } catch (gpuErr) {
      console.warn("GPU init failed, trying CPU fallback:", gpuErr);
      setState((s) => ({ ...s, error: "GPU mode unavailable, trying CPU fallback…" }));
      try {
        hands = await createAndInitHands(locateFile, onResults, true, 20000);
        console.log("MediaPipe Hands initialized successfully (CPU fallback)");
        setState((s) => ({ ...s, error: null }));
      } catch (cpuErr) {
        console.error("MediaPipe initialization failed (both GPU and CPU):", cpuErr);
        setState((s) => ({
          ...s,
          error: `Hand tracking failed to initialize. Camera feed is still active. Error: ${(cpuErr as Error)?.message || "Unknown"}`,
        }));
        return;
      }
    }

    handsRef.current = hands;
    setState((s) => ({ ...s, trackingReady: true }));

    // Frame loop
    let animId: number;
    let consecutiveErrors = 0;
    const processFrame = async () => {
      try {
        if (videoRef.current && videoRef.current.readyState >= 2) {
          await hands!.send({ image: videoRef.current });
          consecutiveErrors = 0;
        }
      } catch (err) {
        consecutiveErrors++;
        if (consecutiveErrors === 1) {
          console.warn("Hand tracking frame error:", err);
        }
        if (consecutiveErrors === 10) {
          setState((s) => ({ ...s, error: "Hand tracking is having trouble. Gestures may not work reliably." }));
        }
      }
      animId = requestAnimationFrame(processFrame);
    };
    animId = requestAnimationFrame(processFrame);

    cameraRef.current = { stop: () => cancelAnimationFrame(animId) };
  }, [videoRef, canvasRef, resolveHandedness, customGestureProfiles]);

  const cleanup = useCallback(() => {
    try { cameraRef.current?.stop(); } catch (_) {}
    cameraRef.current = null;
    try { handsRef.current?.close(); } catch (_) {}
    handsRef.current = null;
    stableGestureRef.current = null;
    candidateGestureRef.current = null;
    noneFramesRef.current = 0;
    smoothedLandmarksRef.current.Left = null;
    smoothedLandmarksRef.current.Right = null;
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    resetSwipeHistory();
    handednessStateRef.current = {};
  }, [videoRef]);

  const stop = useCallback(() => {
    cleanup();
    handednessStateRef.current = {};
    setState({
      isLoading: false, isActive: false, trackingReady: false, error: null, gesture: null, landmarks: null,
      hands: [], fps: 0, writingTip: null, isWriting: false, stringMeasurements: [],
    });
    setCalibration({
      baselineReferencePx: baselineReferencePxRef.current,
      currentReferencePx: null,
      effectiveDistanceFactor: Number(tuningRef.current.cameraDistanceFactor.toFixed(2)),
    });
  }, [cleanup]);

  const captureCalibration = useCallback(() => {
    if (!state.hands[0]?.landmarks) return false;
    const wrist = state.hands[0].landmarks[0];
    const mcp = state.hands[0].landmarks[9];
    const canvas = canvasRef.current;
    if (!wrist || !mcp || !canvas) return false;

    const currentRefPx = Math.sqrt(
      ((wrist.x - mcp.x) * canvas.width) ** 2 +
      ((wrist.y - mcp.y) * canvas.height) ** 2
    );
    if (!currentRefPx || Number.isNaN(currentRefPx)) return false;

    baselineReferencePxRef.current = currentRefPx;
    try {
      localStorage.setItem(CALIBRATION_STORAGE_KEY, String(currentRefPx));
    } catch {
      // ignore storage failures
    }
    setCalibration((prev) => ({
      ...prev,
      baselineReferencePx: currentRefPx,
      currentReferencePx: currentRefPx,
      effectiveDistanceFactor: Number(tuningRef.current.cameraDistanceFactor.toFixed(2)),
    }));
    return true;
  }, [canvasRef, state.hands]);

  const clearCalibration = useCallback(() => {
    baselineReferencePxRef.current = null;
    try {
      localStorage.removeItem(CALIBRATION_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
    setCalibration((prev) => ({
      ...prev,
      baselineReferencePx: null,
      effectiveDistanceFactor: Number(tuningRef.current.cameraDistanceFactor.toFixed(2)),
    }));
  }, []);

  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  return { ...state, calibration, start, stop, captureCalibration, clearCalibration };
}


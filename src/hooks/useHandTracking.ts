import { useEffect, useRef, useState, useCallback } from "react";
import { Hands, Results } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import { classifyGesture, detectSwipe, resetSwipeHistory, type GestureResult, type GestureType } from "@/lib/gestures";

export interface HandData {
  landmarks: any[];
  gesture: GestureResult;
  handedness: string; // "Left" | "Right"
}

export interface HandTrackingState {
  isLoading: boolean;
  isActive: boolean;
  gesture: GestureResult | null;
  landmarks: any[] | null;
  hands: HandData[];
  fps: number;
  // Air-writing: index fingertip position (normalized 0-1) for writing hand
  writingTip: { x: number; y: number } | null;
  isWriting: boolean;
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

// Detect "writing pose": index finger extended, other fingers curled
function isWritingPose(landmarks: any[]): boolean {
  const index = isFingerUp(landmarks, 8, 6, 0);
  const middle = isFingerUp(landmarks, 12, 10, 0);
  const ring = isFingerUp(landmarks, 16, 14, 0);
  const pinky = isFingerUp(landmarks, 20, 18, 0);
  return index && !middle && !ring && !pinky;
}

const FINGERTIPS = [4, 8, 12, 16, 20];

const STRING_COLORS = [
  "hsl(0, 100%, 65%)",
  "hsl(45, 100%, 60%)",
  "hsl(120, 80%, 55%)",
  "hsl(200, 100%, 60%)",
  "hsl(280, 80%, 65%)",
  "hsl(330, 90%, 60%)",
];

export function useHandTracking(
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onGestureAction?: (gesture: GestureType) => void,
  drawOverlayRef?: React.MutableRefObject<boolean>,
  drawStringRef?: React.MutableRefObject<boolean>
) {
  const [state, setState] = useState<HandTrackingState>({
    isLoading: true,
    isActive: false,
    gesture: null,
    landmarks: null,
    hands: [],
    fps: 0,
    writingTip: null,
    isWriting: false,
  });

  const cameraRef = useRef<Camera | null>(null);
  const handsRef = useRef<Hands | null>(null);
  const frameCountRef = useRef(0);
  const lastFpsTime = useRef(Date.now());
  const lastActionTime = useRef(0);
  const gestureActionRef = useRef(onGestureAction);
  gestureActionRef.current = onGestureAction;

  const start = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    // Request camera permission explicitly first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      // Assign stream to video element so MediaPipe Camera can use it
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    } catch (err) {
      console.error("Camera access denied or unavailable:", err);
      setState((s) => ({ ...s, isLoading: false, isActive: false }));
      return;
    }

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results: Results) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // FPS
      frameCountRef.current++;
      const now = Date.now();
      if (now - lastFpsTime.current >= 1000) {
        const fps = frameCountRef.current;
        frameCountRef.current = 0;
        lastFpsTime.current = now;
        setState((s) => ({ ...s, fps }));
      }

      const handCount = results.multiHandLandmarks?.length || 0;

      if (handCount > 0) {
        const handsData: HandData[] = [];
        let primaryGesture: GestureResult | null = null;
        let writingTip: { x: number; y: number } | null = null;
        let isWriting = false;

        for (let h = 0; h < handCount; h++) {
          const landmarks = results.multiHandLandmarks[h];
          const handedness = results.multiHandedness?.[h]?.label || (h === 0 ? "Right" : "Left");
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

          const gesture = classifyGesture(landmarks as any);

          handsData.push({ landmarks: landmarks as any, gesture, handedness });

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

        // Draw finger strings
        const shouldDrawStrings = drawStringRef ? drawStringRef.current : false;
        if (shouldDrawStrings) {
          const allTips: { x: number; y: number }[] = [];
          for (const hand of handsData) {
            for (const tipIdx of FINGERTIPS) {
              const lm = hand.landmarks[tipIdx];
              allTips.push({ x: lm.x * canvas.width, y: lm.y * canvas.height });
            }
          }

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
            }
          }
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
        }

        const swipe = detectSwipe(handsData[0].landmarks);
        const finalGesture = swipe
          ? {
              gesture: swipe,
              confidence: 0.8,
              label: swipe === "swipe_left" ? "Swipe Left" : "Swipe Right",
              action: swipe === "swipe_left" ? "Next Slide →" : "Previous Slide ←",
              emoji: swipe === "swipe_left" ? "👈" : "👉",
            }
          : primaryGesture;

        setState((s) => ({
          ...s,
          gesture: finalGesture,
          landmarks: handsData[0].landmarks,
          hands: handsData,
          isLoading: false,
          isActive: true,
          writingTip: isWriting ? writingTip : null,
          isWriting,
        }));

        if (finalGesture && finalGesture.gesture !== "none" && !isWriting && now - lastActionTime.current > 1500) {
          lastActionTime.current = now;
          gestureActionRef.current?.(finalGesture.gesture);
        }
      } else {
        setState((s) => ({
          ...s,
          gesture: null,
          landmarks: null,
          hands: [],
          writingTip: null,
          isWriting: false,
        }));
      }
    });

    handsRef.current = hands;

    // Use a frame loop instead of MediaPipe Camera to avoid double getUserMedia
    let animId: number;
    const processFrame = async () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        await hands.send({ image: videoRef.current });
      }
      animId = requestAnimationFrame(processFrame);
    };
    animId = requestAnimationFrame(processFrame);

    // Store cleanup for the frame loop
    cameraRef.current = { stop: () => cancelAnimationFrame(animId) } as any;
    setState((s) => ({ ...s, isLoading: false, isActive: true }));
  }, [videoRef, canvasRef]);

  const cleanup = useCallback(() => {
    try { cameraRef.current?.stop(); } catch (_) {}
    cameraRef.current = null;
    try { handsRef.current?.close(); } catch (_) {}
    handsRef.current = null;
    // Stop video stream tracks
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    resetSwipeHistory();
  }, [videoRef]);

  const stop = useCallback(() => {
    cleanup();
    setState({
      isLoading: false, isActive: false, gesture: null, landmarks: null,
      hands: [], fps: 0, writingTip: null, isWriting: false,
    });
  }, [cleanup]);

  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  return { ...state, start, stop };
}

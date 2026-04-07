import { useEffect, useRef, useState, useCallback } from "react";
import { Hands, Results } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import { classifyGesture, detectSwipe, resetSwipeHistory, type GestureResult, type GestureType } from "@/lib/gestures";

export interface HandTrackingState {
  isLoading: boolean;
  isActive: boolean;
  gesture: GestureResult | null;
  landmarks: any[] | null;
  fps: number;
}

export function useHandTracking(
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onGestureAction?: (gesture: GestureType) => void
) {
  const [state, setState] = useState<HandTrackingState>({
    isLoading: true,
    isActive: false,
    gesture: null,
    landmarks: null,
    fps: 0,
  });

  const cameraRef = useRef<Camera | null>(null);
  const handsRef = useRef<Hands | null>(null);
  const frameCountRef = useRef(0);
  const lastFpsTime = useRef(Date.now());
  const lastActionTime = useRef(0);
  const gestureActionRef = useRef(onGestureAction);
  gestureActionRef.current = onGestureAction;

  const start = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
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

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        // Draw connections
        const connections = [
          [0,1],[1,2],[2,3],[3,4],
          [0,5],[5,6],[6,7],[7,8],
          [0,9],[9,10],[10,11],[11,12],
          [0,13],[13,14],[14,15],[15,16],
          [0,17],[17,18],[18,19],[19,20],
          [5,9],[9,13],[13,17],
        ];

        ctx.strokeStyle = "hsl(187, 100%, 50%)";
        ctx.lineWidth = 2;
        ctx.shadowColor = "hsl(187, 100%, 50%)";
        ctx.shadowBlur = 8;

        for (const [i, j] of connections) {
          const a = landmarks[i];
          const b = landmarks[j];
          ctx.beginPath();
          ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
          ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
          ctx.stroke();
        }

        // Draw landmarks
        for (let i = 0; i < landmarks.length; i++) {
          const lm = landmarks[i];
          const x = lm.x * canvas.width;
          const y = lm.y * canvas.height;
          const isTip = [4, 8, 12, 16, 20].includes(i);

          ctx.beginPath();
          ctx.arc(x, y, isTip ? 6 : 3, 0, 2 * Math.PI);
          ctx.fillStyle = isTip ? "hsl(270, 80%, 60%)" : "hsl(187, 100%, 50%)";
          ctx.shadowColor = isTip ? "hsl(270, 80%, 60%)" : "hsl(187, 100%, 50%)";
          ctx.shadowBlur = isTip ? 15 : 8;
          ctx.fill();
        }

        ctx.shadowBlur = 0;

        // Classify gesture
        const gesture = classifyGesture(landmarks as any);
        const swipe = detectSwipe(landmarks as any);

        const finalGesture = swipe
          ? { gesture: swipe, confidence: 0.8, label: swipe === "swipe_left" ? "Swipe Left" : "Swipe Right", action: swipe === "swipe_left" ? "Next Slide →" : "Previous Slide ←", emoji: swipe === "swipe_left" ? "👈" : "👉" }
          : gesture;

        setState((s) => ({ ...s, gesture: finalGesture, landmarks: landmarks as any, isLoading: false, isActive: true }));

        // Trigger action with cooldown
        if (finalGesture.gesture !== "none" && now - lastActionTime.current > 1500) {
          lastActionTime.current = now;
          gestureActionRef.current?.(finalGesture.gesture);
        }
      } else {
        setState((s) => ({ ...s, gesture: null, landmarks: null }));
      }
    });

    handsRef.current = hands;

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current) {
          await hands.send({ image: videoRef.current });
        }
      },
      width: 640,
      height: 480,
    });

    camera.start();
    cameraRef.current = camera;
    setState((s) => ({ ...s, isLoading: false, isActive: true }));
  }, [videoRef, canvasRef]);

  const cleanup = useCallback(() => {
    try { cameraRef.current?.stop(); } catch (_) {}
    cameraRef.current = null;
    try { handsRef.current?.close(); } catch (_) {}
    handsRef.current = null;
    resetSwipeHistory();
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setState({ isLoading: false, isActive: false, gesture: null, landmarks: null, fps: 0 });
  }, [cleanup]);

  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  return { ...state, start, stop };
}

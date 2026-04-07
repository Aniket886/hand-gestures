import { useEffect, useRef, useState, useCallback } from "react";
import * as faceapi from "face-api.js";

export interface EmotionResult {
  emotion: string;
  confidence: number;
  emoji: string;
  allEmotions: Record<string, number>;
}

const EMOTION_EMOJIS: Record<string, string> = {
  neutral: "😐",
  happy: "😊",
  sad: "😢",
  angry: "😠",
  fearful: "😨",
  disgusted: "🤢",
  surprised: "😲",
};

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model";

let modelsLoaded = false;
let modelsLoading: Promise<void> | null = null;

async function loadModels() {
  if (modelsLoaded) return;
  if (modelsLoading) {
    await modelsLoading;
    return;
  }
  modelsLoading = (async () => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
  })();
  await modelsLoading;
}

export function useFaceEmotion(
  videoRef: React.RefObject<HTMLVideoElement>,
  enabled: boolean
) {
  const [emotion, setEmotion] = useState<EmotionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const startDetection = useCallback(async () => {
    if (!videoRef.current) return;
    setIsLoading(true);
    try {
      await loadModels();
    } catch (e) {
      console.error("Failed to load face-api models:", e);
      setIsLoading(false);
      return;
    }
    setIsLoading(false);

    // Clear any existing interval
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = window.setInterval(async () => {
      if (!enabledRef.current || !videoRef.current || videoRef.current.readyState < 2) return;

      try {
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
          .withFaceExpressions();

        if (detection) {
          const expressions = detection.expressions;
          const sorted = Object.entries(expressions).sort(([, a], [, b]) => b - a);
          const [topEmotion, topConfidence] = sorted[0];

          setEmotion({
            emotion: topEmotion,
            confidence: topConfidence,
            emoji: EMOTION_EMOJIS[topEmotion] || "🤔",
            allEmotions: expressions as unknown as Record<string, number>,
          });
        }
      } catch {
        // Detection frame error — skip silently
      }
    }, 500); // Run every 500ms to avoid overloading
  }, [videoRef]);

  const stopDetection = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setEmotion(null);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { emotion, isLoading, startDetection, stopDetection };
}

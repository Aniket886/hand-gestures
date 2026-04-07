import { useRef, useState, useCallback } from "react";
import type { EmotionResult } from "./useFaceEmotion";

export interface EngagementData {
  score: number; // 0-100
  trend: "rising" | "falling" | "stable";
  history: number[]; // last N scores
  dominantEmotion: string;
  sessionDuration: number; // seconds
}

const POSITIVE_EMOTIONS = ["happy", "surprised"];
const NEGATIVE_EMOTIONS = ["sad", "angry", "fearful", "disgusted"];
const HISTORY_LENGTH = 30;

function emotionToEngagement(allEmotions: Record<string, number>): number {
  const positive = POSITIVE_EMOTIONS.reduce((sum, e) => sum + (allEmotions[e] || 0), 0);
  const negative = NEGATIVE_EMOTIONS.reduce((sum, e) => sum + (allEmotions[e] || 0), 0);
  const neutral = allEmotions["neutral"] || 0;

  // Positive emotions boost score, negative reduce, neutral is baseline
  return Math.min(100, Math.max(0, Math.round((positive * 100 + neutral * 50 - negative * 30))));
}

export function useEngagementScore() {
  const [data, setData] = useState<EngagementData | null>(null);
  const historyRef = useRef<number[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const emotionCountsRef = useRef<Record<string, number>>({});

  const update = useCallback((emotion: EmotionResult | null) => {
    if (!emotion) return;

    if (!startTimeRef.current) startTimeRef.current = Date.now();

    const score = emotionToEngagement(emotion.allEmotions);
    historyRef.current.push(score);
    if (historyRef.current.length > HISTORY_LENGTH) historyRef.current.shift();

    // Track dominant emotion
    emotionCountsRef.current[emotion.emotion] =
      (emotionCountsRef.current[emotion.emotion] || 0) + 1;

    const dominantEmotion = Object.entries(emotionCountsRef.current).sort(
      ([, a], [, b]) => b - a
    )[0]?.[0] || "neutral";

    const h = historyRef.current;
    const avg = h.reduce((a, b) => a + b, 0) / h.length;

    let trend: "rising" | "falling" | "stable" = "stable";
    if (h.length >= 5) {
      const recentAvg = h.slice(-5).reduce((a, b) => a + b, 0) / 5;
      const olderAvg = h.slice(-10, -5).reduce((a, b) => a + b, 0) / Math.min(5, h.slice(-10, -5).length || 1);
      if (recentAvg > olderAvg + 5) trend = "rising";
      else if (recentAvg < olderAvg - 5) trend = "falling";
    }

    setData({
      score: Math.round(avg),
      trend,
      history: [...h],
      dominantEmotion,
      sessionDuration: Math.round((Date.now() - startTimeRef.current) / 1000),
    });
  }, []);

  const reset = useCallback(() => {
    historyRef.current = [];
    startTimeRef.current = null;
    emotionCountsRef.current = {};
    setData(null);
  }, []);

  return { engagement: data, updateEngagement: update, resetEngagement: reset };
}

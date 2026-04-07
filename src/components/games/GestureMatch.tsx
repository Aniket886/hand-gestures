import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GESTURE_MAP, type GestureType, type GestureResult } from "@/lib/gestures";

interface GestureMatchProps {
  currentGesture: GestureResult | null;
  isActive: boolean;
  onScoreChange: (score: number) => void;
}

const PLAYABLE_GESTURES: GestureType[] = [
  "open_palm", "fist", "pointing", "thumbs_up", "thumbs_down",
  "peace", "rock", "love_you", "call_me", "ok_sign", "pinch",
  "three", "four", "pinky_up", "gun", "vulcan",
];

export default function GestureMatch({ currentGesture, isActive, onScoreChange }: GestureMatchProps) {
  const [target, setTarget] = useState<GestureType | null>(null);
  const [timeLeft, setTimeLeft] = useState(5);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const scoreRef = useRef(0);
  const matchedRef = useRef(false);

  const pickRandom = useCallback(() => {
    const g = PLAYABLE_GESTURES[Math.floor(Math.random() * PLAYABLE_GESTURES.length)];
    setTarget(g);
    setTimeLeft(5);
    setFeedback(null);
    matchedRef.current = false;
  }, []);

  // Start round
  useEffect(() => {
    if (isActive && !target) pickRandom();
    if (!isActive) {
      setTarget(null);
      setStreak(0);
      scoreRef.current = 0;
    }
  }, [isActive, target, pickRandom]);

  // Countdown
  useEffect(() => {
    if (!isActive || !target) return;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          // Time's up
          setStreak(0);
          setFeedback("wrong");
          matchedRef.current = true;
          setTimeout(pickRandom, 1000);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isActive, target, pickRandom]);

  // Check gesture match
  useEffect(() => {
    if (!currentGesture || !target || matchedRef.current || !isActive) return;
    if (currentGesture.gesture === target && currentGesture.confidence > 0.5) {
      matchedRef.current = true;
      const streakBonus = streak >= 3 ? 3 : streak >= 2 ? 2 : 1;
      scoreRef.current += streakBonus;
      setStreak((s) => s + 1);
      setFeedback("correct");
      onScoreChange(scoreRef.current);
      setTimeout(pickRandom, 1000);
    }
  }, [currentGesture, target, isActive, streak, onScoreChange, pickRandom]);

  if (!target || !isActive) return null;

  const info = GESTURE_MAP[target];

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={target}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          className="flex flex-col items-center gap-4"
        >
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
            Show this gesture!
          </p>
          <div className="text-8xl">{info?.emoji}</div>
          <p className="font-mono text-lg font-bold text-foreground">{info?.label}</p>

          {/* Timer bar */}
          <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: "100%" }}
              animate={{ width: `${(timeLeft / 5) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="font-mono text-xs text-muted-foreground">{timeLeft}s</p>

          {streak >= 2 && (
            <p className="font-mono text-xs text-primary">
              🔥 Streak: {streak} ({streak >= 3 ? "3x" : "2x"} bonus!)
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Feedback flash */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, scale: 2 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute top-1/3 text-6xl font-bold font-mono ${
              feedback === "correct" ? "text-green-400" : "text-destructive"
            }`}
          >
            {feedback === "correct" ? "✓" : "✗"}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

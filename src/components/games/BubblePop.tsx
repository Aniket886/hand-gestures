import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Bubble {
  id: number;
  x: number; // 0-100 percent
  y: number; // 0-100 percent
  size: number;
  color: string;
  speed: number;
  popped: boolean;
}

interface BubblePopProps {
  fingerPos: { x: number; y: number } | null; // normalized 0-1
  isActive: boolean;
  onScoreChange: (score: number) => void;
}

const COLORS = [
  "187, 100%, 50%",
  "150, 80%, 50%",
  "270, 80%, 60%",
  "40, 90%, 55%",
  "340, 80%, 55%",
  "220, 90%, 60%",
];

let nextId = 0;

export default function BubblePop({ fingerPos, isActive, onScoreChange }: BubblePopProps) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const scoreRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Spawn bubbles
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setBubbles((prev) => {
        if (prev.length > 15) return prev;
        const bubble: Bubble = {
          id: nextId++,
          x: 10 + Math.random() * 80,
          y: 105,
          size: 30 + Math.random() * 40,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          speed: 0.15 + Math.random() * 0.25,
          popped: false,
        };
        return [...prev, bubble];
      });
    }, 800);
    return () => clearInterval(interval);
  }, [isActive]);

  // Float bubbles upward
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setBubbles((prev) =>
        prev
          .map((b) => (b.popped ? b : { ...b, y: b.y - b.speed * 2 }))
          .filter((b) => b.y > -15 && !(b.popped && b.y < -5))
      );
    }, 30);
    return () => clearInterval(interval);
  }, [isActive]);

  // Collision detection with finger
  useEffect(() => {
    if (!fingerPos || !isActive) return;

    // Mirror the x coordinate since camera is mirrored
    const fx = (1 - fingerPos.x) * 100;
    const fy = fingerPos.y * 100;

    setBubbles((prev) => {
      let popped = false;
      const next = prev.map((b) => {
        if (b.popped) return b;
        const dx = b.x - fx;
        const dy = b.y - fy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const hitRadius = (b.size / 10) + 3;
        if (dist < hitRadius) {
          popped = true;
          return { ...b, popped: true };
        }
        return b;
      });
      if (popped) {
        scoreRef.current += 1;
        onScoreChange(scoreRef.current);
      }
      return next;
    });
  }, [fingerPos, isActive, onScoreChange]);

  // Reset on deactivate
  useEffect(() => {
    if (!isActive) {
      setBubbles([]);
      scoreRef.current = 0;
    }
  }, [isActive]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Finger cursor */}
      {fingerPos && (
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-primary bg-primary/30 z-50"
          style={{
            left: `${(1 - fingerPos.x) * 100}%`,
            top: `${fingerPos.y * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      )}
      <AnimatePresence>
        {bubbles.map((b) =>
          b.popped ? (
            <motion.div
              key={b.id}
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute rounded-full flex items-center justify-center font-mono text-xs font-bold"
              style={{
                left: `${b.x}%`,
                top: `${b.y}%`,
                width: b.size,
                height: b.size,
                transform: "translate(-50%, -50%)",
                color: `hsl(${b.color})`,
              }}
            >
              +1
            </motion.div>
          ) : (
            <motion.div
              key={b.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.85 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute rounded-full"
              style={{
                left: `${b.x}%`,
                top: `${b.y}%`,
                width: b.size,
                height: b.size,
                transform: "translate(-50%, -50%)",
                background: `radial-gradient(circle at 35% 35%, ${b.color}88, ${b.color})`,
                boxShadow: `0 0 20px ${b.color}44`,
                border: `1px solid ${b.color}66`,
              }}
            />
          )
        )}
      </AnimatePresence>
    </div>
  );
}

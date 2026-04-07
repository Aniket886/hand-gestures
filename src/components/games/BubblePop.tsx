import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  speed: number;
  popped: boolean;
  isBomb: boolean;
}

interface BubblePopProps {
  fingerPos: { x: number; y: number } | null;
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
  const [gameOver, setGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const scoreRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dynamic spawn rate & cap based on score
  const spawnInterval = Math.max(200, 800 - scoreRef.current * 15);
  const maxBubbles = Math.min(40, 15 + Math.floor(scoreRef.current / 3));
  // Bomb chance increases with score (5% base, up to 25%)
  const bombChance = Math.min(0.25, 0.05 + scoreRef.current * 0.01);

  // Spawn bubbles
  useEffect(() => {
    if (!isActive || gameOver) return;
    const interval = setInterval(() => {
      setBubbles((prev) => {
        if (prev.filter((b) => !b.popped).length >= maxBubbles) return prev;
        const isBomb = Math.random() < bombChance;
        const bubble: Bubble = {
          id: nextId++,
          x: 10 + Math.random() * 80,
          y: 105,
          size: isBomb ? 35 + Math.random() * 25 : 30 + Math.random() * 40,
          color: isBomb ? "0, 0%, 20%" : COLORS[Math.floor(Math.random() * COLORS.length)],
          speed: 0.15 + Math.random() * 0.25,
          popped: false,
          isBomb,
        };
        return [...prev, bubble];
      });
    }, spawnInterval);
    return () => clearInterval(interval);
  }, [isActive, gameOver, spawnInterval, maxBubbles, bombChance]);

  // Float bubbles upward
  useEffect(() => {
    if (!isActive || gameOver) return;
    const interval = setInterval(() => {
      setBubbles((prev) =>
        prev
          .map((b) => (b.popped ? b : { ...b, y: b.y - b.speed * 2 }))
          .filter((b) => b.y > -15 && !(b.popped && b.y < -5))
      );
    }, 30);
    return () => clearInterval(interval);
  }, [isActive, gameOver]);

  // Collision detection
  useEffect(() => {
    if (!fingerPos || !isActive || gameOver) return;

    const fx = (1 - fingerPos.x) * 100;
    const fy = fingerPos.y * 100;

    setBubbles((prev) => {
      let popCount = 0;
      let hitBomb = false;
      const next = prev.map((b) => {
        if (b.popped) return b;
        const dx = b.x - fx;
        const dy = b.y - fy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const hitRadius = (b.size / 10) + 3;
        if (dist < hitRadius) {
          if (b.isBomb) {
            hitBomb = true;
          } else {
            popCount++;
          }
          return { ...b, popped: true };
        }
        return b;
      });
      if (hitBomb) {
        setFinalScore(scoreRef.current);
        setTimeout(() => setGameOver(true), 0);
      } else if (popCount > 0) {
        scoreRef.current += popCount;
        setTimeout(() => onScoreChange(scoreRef.current), 0);
      }
      return next;
    });
  }, [fingerPos, isActive, onScoreChange, gameOver]);

  // Reset on deactivate
  useEffect(() => {
    if (!isActive) {
      setBubbles([]);
      scoreRef.current = 0;
      setGameOver(false);
      setFinalScore(0);
    }
  }, [isActive]);

  const restart = useCallback(() => {
    setBubbles([]);
    scoreRef.current = 0;
    setGameOver(false);
    setFinalScore(0);
    onScoreChange(0);
  }, [onScoreChange]);

  // Game over screen
  if (gameOver && isActive) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto z-50 bg-background/80 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="text-7xl">💥</div>
          <p className="font-mono text-2xl font-bold text-destructive">GAME OVER</p>
          <p className="font-mono text-lg text-foreground">Score: {finalScore}</p>
          <button
            onClick={restart}
            className="mt-4 px-6 py-3 rounded-lg font-mono text-sm font-medium bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-all"
          >
            Play Again
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden pointer-events-none">
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
                color: b.isBomb ? "hsl(0, 80%, 50%)" : `hsl(${b.color})`,
              }}
            >
              {b.isBomb ? "💥" : "+1"}
            </motion.div>
          ) : (
            <motion.div
              key={b.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.85 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute rounded-full flex items-center justify-center"
              style={{
                left: `${b.x}%`,
                top: `${b.y}%`,
                width: b.size,
                height: b.size,
                transform: "translate(-50%, -50%)",
                background: b.isBomb
                  ? "radial-gradient(circle at 35% 35%, hsl(0, 0%, 15%), hsl(0, 0%, 5%))"
                  : `radial-gradient(circle at 35% 35%, hsla(${b.color}, 0.5), hsl(${b.color}))`,
                boxShadow: b.isBomb
                  ? "0 0 20px hsla(0, 80%, 40%, 0.5)"
                  : `0 0 20px hsla(${b.color}, 0.25)`,
                border: b.isBomb
                  ? "2px solid hsl(0, 80%, 40%)"
                  : `1px solid hsla(${b.color}, 0.4)`,
              }}
            >
              {b.isBomb && <span className="text-lg">💣</span>}
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  );
}

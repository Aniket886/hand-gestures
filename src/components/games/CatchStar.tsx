import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CatchStarProps {
  palmPos: { x: number; y: number } | null; // normalized 0-1, palm center
  isActive: boolean;
  onScoreChange: (score: number) => void;
}

export default function CatchStar({ palmPos, isActive, onScoreChange }: CatchStarProps) {
  const [star, setStar] = useState<{ x: number; y: number } | null>(null);
  const [caught, setCaught] = useState(false);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const scoreRef = useRef(0);
  const spawnTime = useRef(Date.now());

  const spawnStar = useCallback(() => {
    const x = 15 + Math.random() * 70;
    const y = 15 + Math.random() * 60;
    setStar({ x, y });
    setCaught(false);
    spawnTime.current = Date.now();
  }, []);

  useEffect(() => {
    if (isActive && !star) spawnStar();
    if (!isActive) {
      setStar(null);
      scoreRef.current = 0;
      setReactionTimes([]);
    }
  }, [isActive, star, spawnStar]);

  // Check collision
  useEffect(() => {
    if (!palmPos || !star || caught || !isActive) return;
    const px = (1 - palmPos.x) * 100;
    const py = palmPos.y * 100;
    const dx = star.x - px;
    const dy = star.y - py;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 8) {
      setCaught(true);
      scoreRef.current += 1;
      const rt = Date.now() - spawnTime.current;
      setReactionTimes((prev) => [...prev.slice(-9), rt]);
      onScoreChange(scoreRef.current);
      setTimeout(spawnStar, 800);
    }
  }, [palmPos, star, caught, isActive, onScoreChange, spawnStar]);

  const avgReaction = reactionTimes.length
    ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
    : 0;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Palm cursor */}
      {palmPos && isActive && (
        <div
          className="absolute w-8 h-8 rounded-full border-2 border-accent bg-accent/20 z-50"
          style={{
            left: `${(1 - palmPos.x) * 100}%`,
            top: `${palmPos.y * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      )}

      {/* Star */}
      <AnimatePresence>
        {star && !caught && isActive && (
          <motion.div
            key={`${star.x}-${star.y}`}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 2, opacity: 0, rotate: 180 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="absolute text-5xl z-40"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              transform: "translate(-50%, -50%)",
              filter: "drop-shadow(0 0 15px hsl(40, 90%, 55%))",
            }}
          >
            ⭐
          </motion.div>
        )}
      </AnimatePresence>

      {/* Caught flash */}
      <AnimatePresence>
        {caught && star && (
          <motion.div
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute text-4xl z-40"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            ✨
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      {isActive && avgReaction > 0 && (
        <div className="absolute bottom-4 left-4 font-mono text-xs text-muted-foreground bg-card/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-border">
          ⚡ Avg reaction: {avgReaction}ms
        </div>
      )}

      {/* Instructions */}
      {isActive && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 font-mono text-xs text-muted-foreground">
          Move your open palm to catch the star! ✋
        </div>
      )}
    </div>
  );
}

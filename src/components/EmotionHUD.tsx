import { motion, AnimatePresence } from "framer-motion";
import type { EmotionResult } from "@/hooks/useFaceEmotion";
import { Loader2 } from "lucide-react";

interface EmotionHUDProps {
  emotion: EmotionResult | null;
  isLoading: boolean;
  isActive: boolean;
}

const EMOTION_COLORS: Record<string, string> = {
  happy: "hsl(48, 96%, 53%)",
  sad: "hsl(210, 80%, 55%)",
  angry: "hsl(0, 80%, 55%)",
  fearful: "hsl(270, 60%, 60%)",
  disgusted: "hsl(120, 50%, 40%)",
  surprised: "hsl(30, 90%, 55%)",
  neutral: "hsl(187, 100%, 50%)",
};

const EmotionHUD = ({ emotion, isLoading, isActive }: EmotionHUDProps) => {
  if (!isActive) return null;

  return (
    <div className="absolute bottom-4 left-4 right-4 pointer-events-none z-10">
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-card/80 backdrop-blur-md border border-border rounded-lg px-3 py-2 inline-flex items-center gap-2"
          >
            <Loader2 className="w-3 h-3 animate-spin text-primary" />
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Loading face models…
            </span>
          </motion.div>
        )}

        {!isLoading && emotion && (
          <motion.div
            key={emotion.emotion}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="bg-card/90 backdrop-blur-md border rounded-xl px-4 py-3 inline-block"
            style={{ borderColor: EMOTION_COLORS[emotion.emotion] || "hsl(var(--border))" }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{emotion.emoji}</span>
              <div className="flex flex-col gap-1">
                <span
                  className="font-mono text-xs font-bold uppercase tracking-wider"
                  style={{ color: EMOTION_COLORS[emotion.emotion] }}
                >
                  {emotion.emotion}
                </span>
                {/* Top 3 emotion bars */}
                <div className="flex flex-col gap-0.5 w-32">
                  {Object.entries(emotion.allEmotions)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 3)
                    .map(([name, value]) => (
                      <div key={name} className="flex items-center gap-1.5">
                        <span className="font-mono text-[8px] text-muted-foreground w-14 truncate">
                          {name}
                        </span>
                        <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: EMOTION_COLORS[name] || "hsl(var(--primary))" }}
                            initial={{ width: 0 }}
                            animate={{ width: `${value * 100}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EmotionHUD;

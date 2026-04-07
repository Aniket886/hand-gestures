import { motion, AnimatePresence } from "framer-motion";
import type { GestureResult } from "@/lib/gestures";
import type { HandData } from "@/hooks/useHandTracking";

interface GestureHUDProps {
  gesture: GestureResult | null;
  fps: number;
  isActive: boolean;
  hands?: HandData[];
  isWriting?: boolean;
}

const GestureHUD = ({ gesture, fps, isActive, hands = [], isWriting }: GestureHUDProps) => {
  return (
    <div className="absolute top-4 left-4 right-4 flex items-start justify-between pointer-events-none z-10">
      {/* Status + FPS + Hand count */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-card/80 backdrop-blur-md border border-border rounded-lg px-3 py-2">
          <div className={`w-2 h-2 rounded-full ${isActive ? "bg-primary animate-pulse-glow" : "bg-muted-foreground"}`} />
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
            {isWriting ? "✏️ drawing" : isActive ? "tracking" : "standby"}
          </span>
        </div>
        {isActive && (
          <div className="flex gap-2">
            <div className="bg-card/80 backdrop-blur-md border border-border rounded-lg px-3 py-2">
              <span className="font-mono text-xs text-muted-foreground">{fps} FPS</span>
            </div>
            <div className="bg-card/80 backdrop-blur-md border border-border rounded-lg px-3 py-2">
              <span className="font-mono text-xs text-muted-foreground">
                {hands.length === 0 ? "No hands" : hands.length === 1 ? "1 hand" : "2 hands"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Detected gesture */}
      <AnimatePresence mode="wait">
        {gesture && gesture.gesture !== "none" && (
          <motion.div
            key={gesture.gesture}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-card/90 backdrop-blur-md border border-primary/30 glow-primary rounded-xl px-5 py-3 flex items-center gap-4"
          >
            <span className="text-3xl">{gesture.emoji}</span>
            <div className="flex flex-col">
              <span className="font-mono text-sm font-bold text-primary text-glow">
                {gesture.label}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {gesture.action}
              </span>
              <div className="mt-1 h-1 rounded-full bg-secondary overflow-hidden w-24">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${gesture.confidence * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GestureHUD;

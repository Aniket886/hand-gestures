import { GESTURE_MAP, type GestureType } from "@/lib/gestures";
import { useState } from "react";

const allGestures: GestureType[] = [
  "pointing", "peace", "open_palm", "fist",
  "thumbs_up", "thumbs_down",
  "rock", "love_you", "call_me", "gun",
  "ok_sign", "pinch",
  "three", "four", "vulcan",
  "middle_finger", "pinky_up",
  "swipe_left", "swipe_right",
];

interface GestureLegendProps {
  activeGesture: GestureType | null;
}

const GestureLegend = ({ activeGesture }: GestureLegendProps) => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? allGestures : allGestures.slice(0, 6);

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-3">
        Gesture Controls — {allGestures.length} gestures
      </h3>
      <div className="grid grid-cols-1 gap-1.5">
        {visible.map((g) => {
          const info = GESTURE_MAP[g];
          const isActive = activeGesture === g;
          return (
            <div
              key={g}
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 ${
                isActive
                  ? "bg-primary/10 border border-primary/30 glow-primary"
                  : "bg-secondary/30"
              }`}
            >
              <span className="text-base w-6 text-center flex-shrink-0">{info.emoji}</span>
              <span className={`font-mono text-[11px] font-medium flex-1 min-w-0 truncate ${isActive ? "text-primary text-glow" : "text-foreground"}`}>
                {info.label}
              </span>
              <span className="font-mono text-[9px] text-muted-foreground truncate max-w-[80px]">
                {info.action}
              </span>
            </div>
          );
        })}
      </div>
      {allGestures.length > 6 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 w-full text-center font-mono text-[10px] text-primary hover:text-primary/80 uppercase tracking-widest transition-colors"
        >
          {expanded ? "Show Less ▲" : `Show All ${allGestures.length} ▼`}
        </button>
      )}
    </div>
  );
};

export default GestureLegend;

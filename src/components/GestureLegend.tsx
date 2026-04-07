import { useState } from "react";
import type { GestureType } from "@/lib/gestures";
import type { GestureMapping } from "@/hooks/useGestureMappings";
import { ACTION_OPTIONS } from "@/hooks/useGestureMappings";

interface GestureLegendProps {
  activeGesture: GestureType | null;
  mappings: GestureMapping[];
}

const GestureLegend = ({ activeGesture, mappings }: GestureLegendProps) => {
  const [expanded, setExpanded] = useState(false);
  // Only show mappings with actions assigned first, then the rest
  const sorted = [...mappings].sort((a, b) => {
    if (a.action !== "none" && b.action === "none") return -1;
    if (a.action === "none" && b.action !== "none") return 1;
    return 0;
  });
  const visible = expanded ? sorted : sorted.slice(0, 6);

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-3">
        Gesture Controls — {mappings.length} gestures
      </h3>
      <div className="grid grid-cols-1 gap-1.5">
        {visible.map((mapping, i) => {
          const isActive = activeGesture === mapping.gesture;
          const actionLabel = ACTION_OPTIONS.find((a) => a.value === mapping.action)?.label || "—";
          return (
            <div
              key={`${mapping.gesture}-${i}`}
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 ${
                isActive
                  ? "bg-primary/10 border border-primary/30 glow-primary"
                  : "bg-secondary/30"
              }`}
            >
              <span className="text-base w-6 text-center flex-shrink-0">{mapping.emoji}</span>
              <span className={`font-mono text-[11px] font-medium flex-1 min-w-0 truncate ${isActive ? "text-primary text-glow" : "text-foreground"}`}>
                {mapping.label}
                {mapping.isCustom && <span className="text-accent ml-1 text-[9px]">★</span>}
              </span>
              <span className="font-mono text-[9px] text-muted-foreground truncate max-w-[80px]">
                {actionLabel}
              </span>
            </div>
          );
        })}
      </div>
      {sorted.length > 6 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 w-full text-center font-mono text-[10px] text-primary hover:text-primary/80 uppercase tracking-widest transition-colors"
        >
          {expanded ? "Show Less ▲" : `Show All ${sorted.length} ▼`}
        </button>
      )}
    </div>
  );
};

export default GestureLegend;

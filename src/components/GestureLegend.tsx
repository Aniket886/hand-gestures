import { GESTURE_MAP, type GestureType } from "@/lib/gestures";

const gesturesToShow: GestureType[] = ["pointing", "peace", "open_palm", "fist", "thumbs_up"];

interface GestureLegendProps {
  activeGesture: GestureType | null;
}

const GestureLegend = ({ activeGesture }: GestureLegendProps) => {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-3">
        Gesture Controls
      </h3>
      <div className="space-y-2">
        {gesturesToShow.map((g) => {
          const info = GESTURE_MAP[g];
          const isActive = activeGesture === g;
          return (
            <div
              key={g}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                isActive
                  ? "bg-primary/10 border border-primary/30 glow-primary"
                  : "bg-secondary/30"
              }`}
            >
              <span className="text-lg">{info.emoji}</span>
              <div className="flex-1 min-w-0">
                <span className={`font-mono text-xs font-medium ${isActive ? "text-primary text-glow" : "text-foreground"}`}>
                  {info.label}
                </span>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground truncate">
                {info.action}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GestureLegend;

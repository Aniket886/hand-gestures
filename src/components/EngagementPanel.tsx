import { motion, AnimatePresence } from "framer-motion";
import type { EngagementData } from "@/hooks/useEngagementScore";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface EngagementPanelProps {
  data: EngagementData | null;
  isActive: boolean;
}

const SCORE_LABELS: { min: number; label: string; color: string }[] = [
  { min: 80, label: "Highly Engaged", color: "hsl(142, 71%, 45%)" },
  { min: 60, label: "Engaged", color: "hsl(187, 100%, 50%)" },
  { min: 40, label: "Moderate", color: "hsl(48, 96%, 53%)" },
  { min: 20, label: "Low", color: "hsl(30, 90%, 55%)" },
  { min: 0, label: "Disengaged", color: "hsl(0, 80%, 55%)" },
];

function getScoreInfo(score: number) {
  return SCORE_LABELS.find((s) => score >= s.min) || SCORE_LABELS[SCORE_LABELS.length - 1];
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const TrendIcon = ({ trend }: { trend: string }) => {
  if (trend === "rising") return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (trend === "falling") return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-muted-foreground" />;
};

const MiniChart = ({ history }: { history: number[] }) => {
  if (history.length < 2) return null;
  const max = 100;
  const w = 120;
  const h = 32;
  const points = history.map((v, i) => {
    const x = (i / (history.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  });

  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const EngagementPanel = ({ data, isActive }: EngagementPanelProps) => {
  if (!isActive || !data) return null;

  const info = getScoreInfo(data.score);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="bg-card border border-border rounded-xl p-4 mt-4"
      >
        <h3 className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-3">
          Engagement Score
        </h3>

        <div className="flex items-center gap-4">
          {/* Score circle */}
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle
                cx="18" cy="18" r="15.5"
                fill="none"
                stroke="hsl(var(--secondary))"
                strokeWidth="3"
              />
              <motion.circle
                cx="18" cy="18" r="15.5"
                fill="none"
                stroke={info.color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${data.score * 0.9738} 97.38`}
                initial={{ strokeDasharray: "0 97.38" }}
                animate={{ strokeDasharray: `${data.score * 0.9738} 97.38` }}
                transition={{ duration: 0.5 }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-mono text-sm font-bold" style={{ color: info.color }}>
                {data.score}
              </span>
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-semibold" style={{ color: info.color }}>
                {info.label}
              </span>
              <TrendIcon trend={data.trend} />
            </div>

            <MiniChart history={data.history} />

            <div className="flex items-center gap-3 font-mono text-[9px] text-muted-foreground">
              <span>⏱ {formatDuration(data.sessionDuration)}</span>
              <span>🎭 {data.dominantEmotion}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EngagementPanel;

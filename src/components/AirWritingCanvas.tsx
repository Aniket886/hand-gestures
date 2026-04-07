import { useRef, useEffect, useState, useCallback } from "react";
import { Eraser, Palette, Minus, Plus, Trash2, PenTool } from "lucide-react";

interface DrawingPoint {
  x: number;
  y: number;
}

interface DrawingStroke {
  points: DrawingPoint[];
  color: string;
  width: number;
}

const COLORS = [
  "hsl(0, 100%, 60%)",    // Red
  "hsl(187, 100%, 50%)",  // Cyan
  "hsl(270, 80%, 60%)",   // Purple
  "hsl(40, 90%, 55%)",    // Orange
  "hsl(150, 80%, 50%)",   // Green
  "hsl(60, 90%, 55%)",    // Yellow
  "hsl(0, 0%, 100%)",     // White
];

interface AirWritingCanvasProps {
  writingTip: { x: number; y: number } | null;
  isWriting: boolean;
  isActive: boolean;
  currentGesture?: string | null;
}

const AirWritingCanvas = ({ writingTip, isWriting, isActive, currentGesture }: AirWritingCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<DrawingStroke[]>([]);
  const currentStrokeRef = useRef<DrawingStroke | null>(null);
  const wasWritingRef = useRef(false);
  const smoothedRef = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [showPalette, setShowPalette] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);
  const SMOOTHING = 0.35; // lower = smoother but laggier

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const allStrokes = [...strokesRef.current];
    if (currentStrokeRef.current) allStrokes.push(currentStrokeRef.current);

    for (const stroke of allStrokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = stroke.color;
      ctx.shadowBlur = stroke.width * 2;

      const pts = stroke.points;
      ctx.moveTo(pts[0].x * canvas.width, pts[0].y * canvas.height);

      if (pts.length === 2) {
        ctx.lineTo(pts[1].x * canvas.width, pts[1].y * canvas.height);
      } else {
        // Use quadratic bezier curves through midpoints for smooth lines
        for (let i = 1; i < pts.length - 1; i++) {
          const cpX = pts[i].x * canvas.width;
          const cpY = pts[i].y * canvas.height;
          const nextX = ((pts[i].x + pts[i + 1].x) / 2) * canvas.width;
          const nextY = ((pts[i].y + pts[i + 1].y) / 2) * canvas.height;
          ctx.quadraticCurveTo(cpX, cpY, nextX, nextY);
        }
        // Draw to the last point
        const last = pts[pts.length - 1];
        ctx.lineTo(last.x * canvas.width, last.y * canvas.height);
      }

      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw cursor if writing
    if (writingTip && isWriting) {
      const cursorX = (1 - writingTip.x) * canvas.width;
      ctx.beginPath();
      ctx.arc(cursorX, writingTip.y * canvas.height, strokeWidth + 4, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [writingTip, isWriting, color, strokeWidth]);

  // Handle writing input
  useEffect(() => {
    if (!isActive) return;

    if (isWriting && writingTip) {
      // Mirror x to match the flipped video feed
      const rawX = 1 - writingTip.x;
      const rawY = writingTip.y;

      // Apply exponential smoothing
      let sx: number, sy: number;
      if (smoothedRef.current && wasWritingRef.current) {
        sx = smoothedRef.current.x + SMOOTHING * (rawX - smoothedRef.current.x);
        sy = smoothedRef.current.y + SMOOTHING * (rawY - smoothedRef.current.y);
      } else {
        sx = rawX;
        sy = rawY;
      }
      smoothedRef.current = { x: sx, y: sy };

      if (!wasWritingRef.current) {
        // Start new stroke
        currentStrokeRef.current = {
          points: [{ x: sx, y: sy }],
          color,
          width: strokeWidth,
        };
      } else if (currentStrokeRef.current) {
        // Continue stroke — add point at small intervals for smooth curves
        const pts = currentStrokeRef.current.points;
        const last = pts[pts.length - 1];
        const dx = sx - last.x;
        const dy = sy - last.y;
        if (Math.sqrt(dx * dx + dy * dy) > 0.002) {
          currentStrokeRef.current.points.push({ x: sx, y: sy });
        }
      }
      wasWritingRef.current = true;
    } else {
      // Finger lifted or no longer writing pose → finish stroke
      if (wasWritingRef.current && currentStrokeRef.current && currentStrokeRef.current.points.length > 1) {
        strokesRef.current.push(currentStrokeRef.current);
        setStrokeCount(strokesRef.current.length);
      }
      currentStrokeRef.current = null;
      wasWritingRef.current = false;
      smoothedRef.current = null;
    }

    redraw();
  }, [writingTip, isWriting, isActive, color, strokeWidth, redraw]);

  const clearCanvas = useCallback(() => {
    strokesRef.current = [];
    currentStrokeRef.current = null;
    setStrokeCount(0);
    redraw();
  }, [redraw]);

  // Open palm gesture → erase all
  const palmClearedRef = useRef(false);
  useEffect(() => {
    if (currentGesture === "open_palm" && !palmClearedRef.current && strokesRef.current.length > 0) {
      palmClearedRef.current = true;
      clearCanvas();
    } else if (currentGesture !== "open_palm") {
      palmClearedRef.current = false;
    }
  }, [currentGesture, clearCanvas]);

  const undoLast = useCallback(() => {
    strokesRef.current.pop();
    setStrokeCount(strokesRef.current.length);
    redraw();
  }, [redraw]);

  return (
    <div className="relative w-full h-full">
      {/* Drawing canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-10 pointer-events-none"
      />

      {/* Toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-card/90 backdrop-blur-md border border-border rounded-xl px-3 py-2">
        {/* Writing indicator */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider ${
          isWriting ? "bg-destructive/20 text-destructive border border-destructive/30" : "text-muted-foreground"
        }`}>
          <PenTool className="w-3 h-3" />
          {isWriting ? "Drawing" : "Idle"}
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Color button */}
        <div className="relative">
          <button
            onClick={() => setShowPalette(!showPalette)}
            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:border-primary/50 transition-all"
          >
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
          </button>
          {showPalette && (
            <div className="absolute bottom-full left-0 mb-2 bg-card border border-border rounded-xl p-2 flex gap-1.5 shadow-xl">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setColor(c); setShowPalette(false); }}
                  className={`w-6 h-6 rounded-full transition-all ${color === c ? "ring-2 ring-primary ring-offset-1 ring-offset-card scale-110" : "hover:scale-110"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Stroke width */}
        <button
          onClick={() => setStrokeWidth((w) => Math.max(1, w - 1))}
          className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="font-mono text-[10px] text-muted-foreground w-4 text-center">{strokeWidth}</span>
        <button
          onClick={() => setStrokeWidth((w) => Math.min(12, w + 1))}
          className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
        >
          <Plus className="w-3 h-3" />
        </button>

        <div className="w-px h-5 bg-border" />

        {/* Undo */}
        <button
          onClick={undoLast}
          disabled={strokeCount === 0}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all"
          title="Undo"
        >
          <Eraser className="w-3.5 h-3.5" />
        </button>

        {/* Clear all */}
        <button
          onClick={clearCanvas}
          disabled={strokeCount === 0}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-30 transition-all"
          title="Clear all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default AirWritingCanvas;

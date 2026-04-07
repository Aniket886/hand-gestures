import { useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useHandTracking } from "@/hooks/useHandTracking";
import { resumeAudioContext } from "@/lib/feedback";
import BubblePop from "@/components/games/BubblePop";
import GestureMatch from "@/components/games/GestureMatch";
import CatchStar from "@/components/games/CatchStar";
import { Camera, CameraOff, ArrowLeft, Gamepad2 } from "lucide-react";

type GameMode = "bubble" | "gesture" | "star";

const GAMES: { id: GameMode; label: string; emoji: string; desc: string }[] = [
  { id: "bubble", label: "Bubble Pop", emoji: "🫧", desc: "Point to pop bubbles" },
  { id: "gesture", label: "Gesture Match", emoji: "🎯", desc: "Perform the shown gesture" },
  { id: "star", label: "Catch Star", emoji: "⭐", desc: "Move palm to catch stars" },
];

const PlayCanvas = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handOverlayRef = useRef(true);

  const [gameMode, setGameMode] = useState<GameMode>("bubble");
  const [score, setScore] = useState(0);

  const { isActive, trackingReady, error: trackingError, gesture, fps, hands, writingTip, start, stop } = useHandTracking(
    videoRef as React.RefObject<HTMLVideoElement>,
    canvasRef as React.RefObject<HTMLCanvasElement>,
    undefined,
    handOverlayRef
  );

  const handleStart = useCallback(() => {
    resumeAudioContext();
    start();
  }, [start]);

  const handleGameChange = (mode: GameMode) => {
    setGameMode(mode);
    setScore(0);
  };

  // Palm center position for CatchStar (average of wrist + middle finger base)
  const palmPos = hands.length > 0
    ? (() => {
        const lm = hands[0].landmarks;
        return {
          x: (lm[0].x + lm[9].x) / 2,
          y: (lm[0].y + lm[9].y) / 2,
        };
      })()
    : null;

  return (
    <div className="min-h-screen bg-background grid-bg scanline flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary border border-border transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-primary" />
              <h1 className="font-mono text-sm font-bold text-foreground">Gesture Playground</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Score */}
            <div className="font-mono text-sm text-foreground bg-card border border-border rounded-lg px-4 py-2">
              Score: <span className="text-primary font-bold">{score}</span>
            </div>

            {/* FPS */}
            {isActive && trackingReady && (
              <div className="font-mono text-[10px] text-muted-foreground">
                {fps} FPS
              </div>
            )}
            {isActive && !trackingReady && (
              <div className="font-mono text-[10px] text-accent">
                Loading model…
              </div>
            )}
            {isActive && trackingError && (
              <div className="font-mono text-[10px] text-destructive max-w-[200px] truncate">
                ⚠️ {trackingError}
              </div>
            )}

            <button
              onClick={isActive ? stop : handleStart}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-medium transition-all duration-300 ${
                isActive
                  ? "bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20"
                  : "bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 glow-primary"
              }`}
            >
              {isActive ? (
                <>
                  <CameraOff className="w-4 h-4" />
                  Stop
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  Start Camera
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Game selector */}
      <div className="container py-3">
        <div className="flex gap-2">
          {GAMES.map((g) => (
            <button
              key={g.id}
              onClick={() => handleGameChange(g.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs transition-all border ${
                gameMode === g.id
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <span>{g.emoji}</span>
              <span>{g.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 container pb-4 flex gap-4">
        {/* Camera feed (small) */}
        <div className="w-64 shrink-0">
          <div className="relative bg-card border border-border rounded-xl overflow-hidden aspect-[4/3]">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full transform -scale-x-100"
            />
            {!isActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/90">
                <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="font-mono text-[10px] text-muted-foreground text-center px-2">
                  Start camera to play
                </p>
              </div>
            )}
          </div>

          {/* Current gesture */}
          {isActive && gesture && gesture.gesture !== "none" && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 bg-card border border-border rounded-lg px-3 py-2 font-mono text-xs text-center"
            >
              <span className="text-lg">{gesture.emoji}</span>
              <p className="text-muted-foreground mt-1">{gesture.label}</p>
            </motion.div>
          )}

          {/* Game instructions */}
          <div className="mt-3 bg-card border border-border rounded-lg px-3 py-3">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-2">
              How to play
            </p>
            {gameMode === "bubble" && (
              <p className="font-mono text-xs text-foreground/80">
                Point with your index finger (writing pose) to aim. Pop bubbles by touching them with your fingertip!
              </p>
            )}
            {gameMode === "gesture" && (
              <p className="font-mono text-xs text-foreground/80">
                Show the gesture displayed on screen before time runs out. Build streaks for bonus points!
              </p>
            )}
            {gameMode === "star" && (
              <p className="font-mono text-xs text-foreground/80">
                Open your palm and move it over the star to catch it. Track your reaction time!
              </p>
            )}
          </div>
        </div>

        {/* Game canvas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 relative bg-card rounded-xl border border-border overflow-hidden"
        >
          {!isActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Gamepad2 className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <p className="font-mono text-sm text-muted-foreground">
                Start camera to begin playing
              </p>
              <p className="font-mono text-xs text-muted-foreground/60 mt-1">
                {GAMES.find((g) => g.id === gameMode)?.desc}
              </p>
            </div>
          )}

          {gameMode === "bubble" && (
            <BubblePop
              fingerPos={writingTip}
              isActive={isActive}
              onScoreChange={setScore}
            />
          )}

          {gameMode === "gesture" && (
            <GestureMatch
              currentGesture={gesture}
              isActive={isActive}
              onScoreChange={setScore}
            />
          )}

          {gameMode === "star" && (
            <CatchStar
              palmPos={palmPos}
              isActive={isActive}
              onScoreChange={setScore}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default PlayCanvas;

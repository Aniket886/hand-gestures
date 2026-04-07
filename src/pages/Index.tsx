import { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useHandTracking } from "@/hooks/useHandTracking";
import GestureHUD from "@/components/GestureHUD";
import DemoPresentation from "@/components/DemoPresentation";
import GestureLegend from "@/components/GestureLegend";
import FeedbackControls from "@/components/FeedbackControls";
import { triggerGestureFeedback, resumeAudioContext, type FeedbackSettings } from "@/lib/feedback";
import { GESTURE_MAP, type GestureType } from "@/lib/gestures";
import { Camera, CameraOff, Hand } from "lucide-react";

const TOTAL_SLIDES = 4;

const Index = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [feedbackSettings, setFeedbackSettings] = useState<FeedbackSettings>({
    soundEnabled: true,
    hapticEnabled: true,
    voiceEnabled: true,
  });
  const feedbackSettingsRef = useRef(feedbackSettings);
  feedbackSettingsRef.current = feedbackSettings;

  const handleGestureAction = useCallback((gesture: GestureType) => {
    const info = GESTURE_MAP[gesture];
    if (info) {
      triggerGestureFeedback(gesture, info.label, feedbackSettingsRef.current);
    }

    if (gesture === "pointing" || gesture === "swipe_left") {
      setCurrentSlide((s) => Math.min(s + 1, TOTAL_SLIDES - 1));
    } else if (gesture === "peace" || gesture === "swipe_right") {
      setCurrentSlide((s) => Math.max(s - 1, 0));
    }
  }, []);

  const { isLoading, isActive, gesture, fps, start, stop } = useHandTracking(
    videoRef as React.RefObject<HTMLVideoElement>,
    canvasRef as React.RefObject<HTMLCanvasElement>,
    handleGestureAction
  );

  const handleStart = useCallback(() => {
    resumeAudioContext();
    start();
  }, [start]);

  return (
    <div className="min-h-screen bg-background grid-bg scanline">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center glow-primary">
              <Hand className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-mono text-sm font-bold text-foreground tracking-tight">
                GesturePresenter
              </h1>
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                Hand Gesture Recognition
              </p>
            </div>
          </div>

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
                Stop Camera
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                Start Camera
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Webcam feed */}
          <div className="lg:col-span-1">
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
                  <Camera className="w-12 h-12 text-muted-foreground mb-3" />
                  <p className="font-mono text-xs text-muted-foreground text-center px-4">
                    Click "Start Camera" to begin tracking
                  </p>
                </div>
              )}

              {isActive && <GestureHUD gesture={gesture} fps={fps} isActive={isActive} />}
            </div>

            {/* Legend below webcam */}
            <div className="mt-4">
              <GestureLegend activeGesture={gesture?.gesture ?? null} />
            </div>

            {/* Feedback controls */}
            <FeedbackControls settings={feedbackSettings} onChange={setFeedbackSettings} />
          </div>

          {/* Presentation area */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="h-full min-h-[400px] lg:min-h-[500px]"
            >
              <DemoPresentation currentSlide={currentSlide} totalSlides={TOTAL_SLIDES} />
            </motion.div>

            {/* Manual controls */}
            <div className="flex items-center justify-center gap-4 mt-4">
              <button
                onClick={() => setCurrentSlide((s) => Math.max(s - 1, 0))}
                disabled={currentSlide === 0}
                className="px-4 py-2 rounded-lg font-mono text-xs bg-secondary border border-border text-secondary-foreground hover:bg-secondary/80 disabled:opacity-30 transition-all"
              >
                ← Previous
              </button>
              <span className="font-mono text-xs text-muted-foreground">
                {currentSlide + 1} / {TOTAL_SLIDES}
              </span>
              <button
                onClick={() => setCurrentSlide((s) => Math.min(s + 1, TOTAL_SLIDES - 1))}
                disabled={currentSlide === TOTAL_SLIDES - 1}
                className="px-4 py-2 rounded-lg font-mono text-xs bg-secondary border border-border text-secondary-foreground hover:bg-secondary/80 disabled:opacity-30 transition-all"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;

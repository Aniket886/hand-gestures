import { useRef, useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useHandTracking } from "@/hooks/useHandTracking";
import { useFaceEmotion } from "@/hooks/useFaceEmotion";
import { useEngagementScore } from "@/hooks/useEngagementScore";
import { useGestureMappings, type PresentationAction } from "@/hooks/useGestureMappings";
import GestureHUD from "@/components/GestureHUD";
import EmotionHUD from "@/components/EmotionHUD";

import GestureLegend from "@/components/GestureLegend";
import EngagementPanel from "@/components/EngagementPanel";
import FeatureToggles, { type FeatureFlags } from "@/components/FeatureToggles";
import GestureSettingsModal from "@/components/GestureSettingsModal";
import AirWritingCanvas from "@/components/AirWritingCanvas";
import { triggerGestureFeedback, resumeAudioContext } from "@/lib/feedback";
import type { GestureType } from "@/lib/gestures";
import { Camera, CameraOff, Hand, Settings, Presentation, Gamepad2 } from "lucide-react";

const Index = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({
    airWriting: true,
    gestureNavigation: true,
    handOverlay: true,
    faceEmotion: true,
    fingerString: true,
    soundEnabled: true,
    hapticEnabled: true,
    voiceEnabled: true,
  });
  const featureFlagsRef = useRef(featureFlags);
  featureFlagsRef.current = featureFlags;
  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
    mappings,
    updateMapping,
    updateEmoji,
    updateLabel,
    addCustomGesture,
    removeCustomGesture,
    resetToDefaults,
    getActionForGesture,
  } = useGestureMappings();

  const getActionRef = useRef(getActionForGesture);
  getActionRef.current = getActionForGesture;

  const executeAction = useCallback((_action: PresentationAction) => {
    // Presentation actions are handled on the /present page
  }, []);

  const handleGestureAction = useCallback((gesture: GestureType) => {
    const ff = featureFlagsRef.current;

    // If gesture navigation is off, skip everything
    if (!ff.gestureNavigation) return;

    const mapping = mappings.find((m) => m.gesture === gesture);
    const label = mapping?.label || gesture;
    triggerGestureFeedback(gesture, label, {
      soundEnabled: ff.soundEnabled,
      hapticEnabled: ff.hapticEnabled,
      voiceEnabled: ff.voiceEnabled,
    });

    const action = getActionRef.current(gesture);
    if (action !== "none") {
      executeAction(action);
    }
  }, [mappings, executeAction]);

  const handOverlayRef = useRef(true);
  handOverlayRef.current = featureFlags.handOverlay;

  const drawStringRef = useRef(true);
  drawStringRef.current = featureFlags.fingerString;

  const { isActive, gesture, fps, hands, writingTip, isWriting, start, stop } = useHandTracking(
    videoRef as React.RefObject<HTMLVideoElement>,
    canvasRef as React.RefObject<HTMLCanvasElement>,
    handleGestureAction,
    handOverlayRef,
    drawStringRef
  );

  const { emotion, isLoading: emotionLoading, startDetection, stopDetection } = useFaceEmotion(
    videoRef as React.RefObject<HTMLVideoElement>,
    featureFlags.faceEmotion
  );

  const { engagement, updateEngagement, resetEngagement } = useEngagementScore();

  // Start/stop face emotion detection when camera or toggle changes
  useEffect(() => {
    if (isActive && featureFlags.faceEmotion) {
      startDetection();
    } else {
      stopDetection();
      resetEngagement();
    }
  }, [isActive, featureFlags.faceEmotion, startDetection, stopDetection, resetEngagement]);

  // Feed emotion data into engagement score
  useEffect(() => {
    if (emotion && featureFlags.faceEmotion) {
      updateEngagement(emotion);
    }
  }, [emotion, featureFlags.faceEmotion, updateEngagement]);

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

          <div className="flex items-center gap-2">
            <Link
              to="/play"
              className="flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary border border-border transition-all"
            >
              <Gamepad2 className="w-4 h-4" />
              Play
            </Link>
            <Link
              to="/present"
              className="flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary border border-border transition-all"
            >
              <Presentation className="w-4 h-4" />
              Present
            </Link>
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary border border-border transition-all"
            >
              <Settings className="w-4 h-4" />
              Mappings
            </button>
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
        </div>
      </header>

      {/* Main content */}
      <main className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Webcam feed */}
          <div className="lg:col-span-1">
            <div className="relative bg-card border border-border rounded-xl overflow-hidden aspect-video">
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

              {isActive && (
                <div className="absolute top-2 left-2 font-mono text-[10px] text-muted-foreground bg-card/70 backdrop-blur-sm px-2 py-1 rounded">
                  {fps} FPS • {hands.length} hand{hands.length !== 1 ? "s" : ""}
                </div>
              )}

              {isActive && featureFlags.faceEmotion && (
                <EmotionHUD
                  emotion={emotion}
                  isLoading={emotionLoading}
                  isActive={isActive}
                />
              )}
            </div>

            <div className="mt-4">
              <GestureLegend activeGesture={gesture?.gesture ?? null} mappings={mappings} />
            </div>

            <FeatureToggles flags={featureFlags} onChange={setFeatureFlags} />

            {featureFlags.faceEmotion && (
              <EngagementPanel data={engagement} isActive={isActive} />
            )}
          </div>

          {/* Air-writing overlay area */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="relative h-full min-h-[400px] lg:min-h-[500px] bg-card rounded-xl border border-border overflow-hidden"
            >
              {/* Air-writing canvas */}
              {isActive && featureFlags.airWriting && (
                <div className="absolute inset-0 z-30">
                  <AirWritingCanvas
                    writingTip={writingTip}
                    isWriting={isWriting}
                    isActive={isActive}
                  />
                </div>
              )}

              {!isActive && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="font-mono text-xs text-muted-foreground">
                    Start camera to begin air-writing
                  </p>
                </div>
              )}
            </motion.div>

            {/* Tip */}
            {isActive && (
              <div className="mt-2 text-center">
                <p className="font-mono text-[10px] text-muted-foreground">
                  ✏️ Point with index finger only to draw • Use other gestures to navigate
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <GestureSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        mappings={mappings}
        onUpdateAction={updateMapping}
        onUpdateEmoji={updateEmoji}
        onUpdateLabel={updateLabel}
        onAddCustom={addCustomGesture}
        onRemoveCustom={removeCustomGesture}
        onReset={resetToDefaults}
      />
    </div>
  );
};

export default Index;

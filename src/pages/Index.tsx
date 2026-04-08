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
import TrackingCalibrationPanel from "@/components/TrackingCalibrationPanel";
import { triggerGestureFeedback, resumeAudioContext } from "@/lib/feedback";
import type { GestureType } from "@/lib/gestures";
import { Camera, CameraOff, Hand, Settings, Presentation, Gamepad2, Loader2 } from "lucide-react";
import Footer from "@/components/Footer";
import { useTrackingPreferences } from "@/hooks/useTrackingPreferences";

const Index = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({
    airWriting: true,
    gestureNavigation: true,
    handOverlay: true,
    faceEmotion: true,
    fingerString: true,
    measuring: true,
    soundEnabled: true,
    hapticEnabled: true,
    voiceEnabled: true,
  });
  const featureFlagsRef = useRef(featureFlags);
  featureFlagsRef.current = featureFlags;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { settings: trackingSettings, updateSetting: updateTrackingSetting, resetSettings: resetTrackingSettings } =
    useTrackingPreferences();

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

  const drawMeasureRef = useRef(true);
  drawMeasureRef.current = featureFlags.measuring;

  const {
    isActive,
    isLoading,
    trackingReady,
    error: cameraError,
    gesture,
    fps,
    hands,
    writingTip,
    isWriting,
    calibration,
    start,
    stop,
    captureCalibration,
    clearCalibration,
  } = useHandTracking(
    videoRef as React.RefObject<HTMLVideoElement>,
    canvasRef as React.RefObject<HTMLCanvasElement>,
    handleGestureAction,
    handOverlayRef,
    drawStringRef,
    drawMeasureRef,
    trackingSettings
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
      <main className="container py-4">
        {/* Camera — full width, large */}
        <div className="relative bg-card border border-border rounded-xl overflow-hidden w-full" style={{ aspectRatio: "16/9" }}>
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

          {/* Air-writing overlay on camera */}
          {isActive && featureFlags.airWriting && (
            <div className="absolute inset-0 z-30">
              <AirWritingCanvas
                writingTip={writingTip}
                isWriting={isWriting}
                isActive={isActive}
                currentGesture={gesture?.gesture ?? null}
              />
            </div>
          )}

          {!isActive && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/90">
              <Camera className="w-16 h-16 text-muted-foreground mb-3" />
              <p className="font-mono text-sm text-muted-foreground text-center px-4">
                Click "Start Camera" to begin tracking
              </p>
              {cameraError && (
                <p className="font-mono text-xs text-destructive text-center px-6 mt-2 max-w-md">
                  ⚠️ {cameraError}
                </p>
              )}
            </div>
          )}

          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/90 z-40">
              <Loader2 className="w-12 h-12 text-primary animate-spin mb-3" />
              <p className="font-mono text-sm text-primary text-center">
                Initializing hand tracking model…
              </p>
              <p className="font-mono text-[10px] text-muted-foreground mt-1">
                Loading MediaPipe WASM
              </p>
            </div>
          )}

          {isActive && !trackingReady && !isLoading && (
            <div className="absolute top-3 left-3 font-mono text-xs text-accent bg-card/70 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading hand model…
            </div>
          )}

          {isActive && trackingReady && (
            <div className="absolute top-3 left-3 font-mono text-xs text-muted-foreground bg-card/70 backdrop-blur-sm px-3 py-1.5 rounded-lg">
              {fps} FPS • {hands.length} hand{hands.length !== 1 ? "s" : ""}
            </div>
          )}

          {isActive && cameraError && (
            <div className="absolute top-3 right-3 font-mono text-[10px] text-destructive bg-card/80 backdrop-blur-sm px-3 py-1.5 rounded-lg max-w-xs">
              ⚠️ {cameraError}
            </div>
          )}

          {isActive && featureFlags.faceEmotion && (
            <EmotionHUD
              emotion={emotion}
              isLoading={emotionLoading}
              isActive={isActive}
            />
          )}

          {isActive && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 font-mono text-[10px] text-muted-foreground bg-card/70 backdrop-blur-sm px-3 py-1 rounded-lg">
              ✏️ Point with index finger to draw • Use gestures to navigate
            </div>
          )}
        </div>

        {/* Controls row below camera */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          <div className="lg:col-span-2">
            <GestureLegend activeGesture={gesture?.gesture ?? null} mappings={mappings} />
          </div>
          <div className="space-y-4">
            <FeatureToggles flags={featureFlags} onChange={setFeatureFlags} />
            <TrackingCalibrationPanel
              settings={trackingSettings}
              calibration={calibration}
              hands={hands}
              isActive={isActive}
              onChangeSetting={updateTrackingSetting}
              onResetSettings={resetTrackingSettings}
              onCaptureCalibration={captureCalibration}
              onClearCalibration={clearCalibration}
            />
            {featureFlags.faceEmotion && (
              <EngagementPanel data={engagement} isActive={isActive} />
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

      <Footer />
    </div>
  );
};

export default Index;

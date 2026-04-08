import { useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Camera, CameraOff, Cuboid, Orbit, PenTool, Sparkles, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useHandTracking } from "@/hooks/useHandTracking";
import { useSpatialInteractionController } from "@/hooks/useSpatialInteractionController";
import { SpatialScene } from "@/components/SpatialScene";
import Footer from "@/components/Footer";

const SpatialStudio = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handOverlayRef = useRef(true);
  const drawStringRef = useRef(false);
  const drawMeasureRef = useRef(false);

  const { isActive, isLoading, trackingReady, hands, start, stop } = useHandTracking(
    videoRef as React.RefObject<HTMLVideoElement>,
    canvasRef as React.RefObject<HTMLCanvasElement>,
    undefined,
    handOverlayRef,
    drawStringRef,
    drawMeasureRef
  );

  const {
    mode,
    setMode,
    objects,
    gestures,
    draftStrokes,
    interaction,
    commitDrawing,
    clearDraft,
    clearObjects,
    resetSolar,
  } = useSpatialInteractionController(hands);

  const modeSummary = useMemo(() => {
    if (mode === "draw") return "Trace shapes in the camera pane. Commit them into 3D objects when ready.";
    if (mode === "spatial") return "Pinch to grab and move created objects. Use two hands to scale.";
    return "Explore and manipulate the interactive solar system in 360 degrees.";
  }, [mode]);

  return (
    <div className="min-h-screen bg-background grid-bg scanline flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container flex items-center justify-between py-4 gap-4">
          <div>
            <h1 className="font-mono text-sm font-bold text-foreground tracking-tight">ArcMotion Spatial Studio</h1>
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Draw, grab, rotate, scale, zoom</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="px-3 py-2 rounded-lg font-mono text-xs text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary border border-border transition-all"
            >
              Back
            </Link>
            <button
              onClick={isActive ? stop : start}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-medium transition-all ${
                isActive
                  ? "bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20"
                  : "bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20"
              }`}
            >
              {isActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
              {isActive ? "Stop Camera" : "Start Camera"}
            </button>
          </div>
        </div>
      </header>

      <main className="container py-4 flex-1 space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4">
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Modes</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setMode("draw")}
                  className={`px-3 py-2 rounded-xl font-mono text-xs border transition-all ${mode === "draw" ? "bg-primary/10 border-primary/40 text-primary" : "bg-secondary/40 border-border text-muted-foreground"}`}
                >
                  <PenTool className="w-4 h-4 inline mr-2" />
                  Draw
                </button>
                <button
                  onClick={() => setMode("spatial")}
                  className={`px-3 py-2 rounded-xl font-mono text-xs border transition-all ${mode === "spatial" ? "bg-primary/10 border-primary/40 text-primary" : "bg-secondary/40 border-border text-muted-foreground"}`}
                >
                  <Cuboid className="w-4 h-4 inline mr-2" />
                  Spatial
                </button>
                <button
                  onClick={() => setMode("solar")}
                  className={`px-3 py-2 rounded-xl font-mono text-xs border transition-all ${mode === "solar" ? "bg-primary/10 border-primary/40 text-primary" : "bg-secondary/40 border-border text-muted-foreground"}`}
                >
                  <Orbit className="w-4 h-4 inline mr-2" />
                  Solar
                </button>
              </div>
              <p className="font-mono text-xs text-foreground/80">{modeSummary}</p>
            </div>

            <div className="relative bg-card border border-border rounded-2xl overflow-hidden aspect-[4/3]">
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover transform -scale-x-100" playsInline muted />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full transform -scale-x-100" />
              {!isActive && !isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/90">
                  <Camera className="w-10 h-10 text-muted-foreground mb-2" />
                  <p className="font-mono text-xs text-muted-foreground">Start camera for hand input</p>
                </div>
              )}
              {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/90">
                  <Sparkles className="w-10 h-10 text-primary mb-2 animate-pulse" />
                  <p className="font-mono text-xs text-primary">Initializing hand tracking...</p>
                </div>
              )}
              {trackingReady && (
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                  <div className="bg-card/75 border border-border rounded-lg px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
                    {hands.length} hand{hands.length !== 1 ? "s" : ""} • {interaction.mode === "object" ? "Grab" : interaction.mode === "scene" ? "Scene" : gestures.primaryPinch ? "Pinch" : "Open"}
                  </div>
                  <div className="bg-card/75 border border-border rounded-lg px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
                    {mode === "draw"
                      ? `${Object.values(draftStrokes).reduce((total, stroke) => total + stroke.points.length, 0)} pts`
                      : `${objects.length} objects`}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Interaction</p>
              <p className="font-mono text-xs text-foreground/80">Primary pinch grabs/releases. Two-hand pinch scales the selected object or scene object in focus.</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={commitDrawing}
                  disabled={!Object.values(draftStrokes).some((stroke) => stroke.points.length >= 4)}
                  className="px-3 py-2 rounded-xl font-mono text-xs bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 disabled:opacity-40 transition-all"
                >
                  Commit Drawing
                </button>
                <button
                  onClick={clearDraft}
                  className="px-3 py-2 rounded-xl font-mono text-xs bg-secondary/40 border border-border text-muted-foreground hover:text-foreground transition-all"
                >
                  Clear Draft
                </button>
                <button
                  onClick={clearObjects}
                  className="px-3 py-2 rounded-xl font-mono text-xs bg-secondary/40 border border-border text-muted-foreground hover:text-foreground transition-all"
                >
                  <Trash2 className="w-4 h-4 inline mr-2" />
                  Clear Objects
                </button>
              </div>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <SpatialScene mode={mode} objects={objects} gestures={gestures} onObjectsChange={setObjects} onResetSolar={resetSolar} />
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SpatialStudio;

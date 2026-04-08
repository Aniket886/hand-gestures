import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, CameraOff, Cuboid, Orbit, PenTool, Sparkles, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useHandTracking } from "@/hooks/useHandTracking";
import { useSpatialGestures } from "@/hooks/useSpatialGestures";
import { SpatialScene } from "@/components/SpatialScene";
import type { SpatialMode, SpatialObject, SpatialStrokePoint } from "@/lib/spatialTypes";
import { SOLAR_SYSTEM_OBJECTS } from "@/lib/spatialSceneData";
import Footer from "@/components/Footer";

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeStroke(points: SpatialStrokePoint[]) {
  if (points.length === 0) return points;
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);

  return points.map((point) => ({
    x: ((point.x - minX) / width - 0.5) * 3,
    y: -((point.y - minY) / height - 0.5) * 2.2,
  }));
}

const SpatialStudio = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handOverlayRef = useRef(true);
  const drawStringRef = useRef(false);
  const drawMeasureRef = useRef(false);

  const [mode, setMode] = useState<SpatialMode>("draw");
  const [objects, setObjects] = useState<SpatialObject[]>([]);
  const [draftStroke, setDraftStroke] = useState<SpatialStrokePoint[]>([]);

  const { isActive, isLoading, trackingReady, hands, writingTip, isWriting, start, stop } = useHandTracking(
    videoRef as React.RefObject<HTMLVideoElement>,
    canvasRef as React.RefObject<HTMLCanvasElement>,
    undefined,
    handOverlayRef,
    drawStringRef,
    drawMeasureRef
  );

  const gestures = useSpatialGestures(hands);

  useEffect(() => {
    if (mode !== "draw") return;
    if (!isWriting || !writingTip) return;

    setDraftStroke((previous) => {
      const nextPoint = { x: writingTip.x * 1000, y: writingTip.y * 1000 };
      const lastPoint = previous[previous.length - 1];
      if (lastPoint && Math.abs(lastPoint.x - nextPoint.x) < 3 && Math.abs(lastPoint.y - nextPoint.y) < 3) {
        return previous;
      }
      return [...previous, nextPoint];
    });
  }, [isWriting, mode, writingTip]);

  useEffect(() => {
    if (mode === "solar") {
      setObjects(SOLAR_SYSTEM_OBJECTS.map((object) => ({ ...object })));
    }
  }, [mode]);

  const commitDrawing = useCallback(() => {
    if (draftStroke.length < 4) return;
    const points = normalizeStroke(draftStroke);
    const drawingObject: SpatialObject = {
      id: randomId("drawing"),
      kind: "drawing",
      label: `Sketch ${objects.filter((object) => object.kind === "drawing").length + 1}`,
      color: "#4cc9f0",
      position: { x: 0, y: 0, z: -1.8 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      defaultPosition: { x: 0, y: 0, z: -1.8 },
      defaultRotation: { x: 0, y: 0, z: 0 },
      defaultScale: { x: 1, y: 1, z: 1 },
      hovered: false,
      selected: false,
      grabbed: false,
      physicsEnabled: false,
      points,
    };
    setObjects((previous) => [...previous, drawingObject]);
    setDraftStroke([]);
    setMode("spatial");
  }, [draftStroke, objects]);

  const clearDraft = useCallback(() => setDraftStroke([]), []);
  const clearObjects = useCallback(() => setObjects((previous) => previous.filter((object) => object.kind === "planet" || object.kind === "star")), []);
  const resetSolar = useCallback(() => setObjects(SOLAR_SYSTEM_OBJECTS.map((object) => ({ ...object }))), []);

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
                    {hands.length} hand{hands.length !== 1 ? "s" : ""} • {gestures.primaryPinch ? "Pinch" : "Open"}
                  </div>
                  <div className="bg-card/75 border border-border rounded-lg px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
                    {mode === "draw" ? `${draftStroke.length} pts` : `${objects.length} objects`}
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
                  disabled={draftStroke.length < 4}
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

import { Ruler, RotateCcw, SlidersHorizontal, Hand } from "lucide-react";
import type { HandData, HandTrackingCalibrationState } from "@/hooks/useHandTracking";
import type { TrackingPreferences } from "@/hooks/useTrackingPreferences";
import { Slider } from "@/components/ui/slider";

interface TrackingCalibrationPanelProps {
  settings: TrackingPreferences;
  calibration: HandTrackingCalibrationState;
  hands: HandData[];
  isActive: boolean;
  onChangeSetting: <K extends keyof TrackingPreferences>(key: K, value: TrackingPreferences[K]) => void;
  onResetSettings: () => void;
  onCaptureCalibration: () => boolean;
  onClearCalibration: () => void;
}

const TrackingCalibrationPanel = ({
  settings,
  calibration,
  hands,
  isActive,
  onChangeSetting,
  onResetSettings,
  onCaptureCalibration,
  onClearCalibration,
}: TrackingCalibrationPanelProps) => {
  const leftCount = hands.filter((hand) => hand.handedness === "Left").length;
  const rightCount = hands.filter((hand) => hand.handedness === "Right").length;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          <h3 className="font-mono text-xs font-bold text-foreground uppercase tracking-wider">Calibration & Detection</h3>
        </div>
        <button
          onClick={onResetSettings}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md font-mono text-[10px] text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary transition-all"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
          <span>Hand Reference Size</span>
          <span>{settings.handReferenceCm.toFixed(1)} cm</span>
        </div>
        <Slider
          value={[settings.handReferenceCm]}
          min={6}
          max={12}
          step={0.1}
          onValueChange={(v) => onChangeSetting("handReferenceCm", v[0])}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
          <span>Camera Distance Factor</span>
          <span>{settings.cameraDistanceFactor.toFixed(2)}x</span>
        </div>
        <Slider
          value={[settings.cameraDistanceFactor]}
          min={0.6}
          max={1.5}
          step={0.01}
          onValueChange={(v) => onChangeSetting("cameraDistanceFactor", v[0])}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
          <span>Gesture Confidence Threshold</span>
          <span>{Math.round(settings.gestureConfidenceThreshold * 100)}%</span>
        </div>
        <Slider
          value={[settings.gestureConfidenceThreshold]}
          min={0.2}
          max={0.95}
          step={0.01}
          onValueChange={(v) => onChangeSetting("gestureConfidenceThreshold", v[0])}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
          <span>Gesture Debounce</span>
          <span>{Math.round(settings.actionDebounceMs)} ms</span>
        </div>
        <Slider
          value={[settings.actionDebounceMs]}
          min={150}
          max={2500}
          step={25}
          onValueChange={(v) => onChangeSetting("actionDebounceMs", v[0])}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
          <span>Handedness Confidence Threshold</span>
          <span>{Math.round(settings.handednessConfidenceThreshold * 100)}%</span>
        </div>
        <Slider
          value={[settings.handednessConfidenceThreshold]}
          min={0.4}
          max={0.98}
          step={0.01}
          onValueChange={(v) => onChangeSetting("handednessConfidenceThreshold", v[0])}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
          <span>Handedness Debounce</span>
          <span>{Math.round(settings.handednessDebounceMs)} ms</span>
        </div>
        <Slider
          value={[settings.handednessDebounceMs]}
          min={0}
          max={1000}
          step={10}
          onValueChange={(v) => onChangeSetting("handednessDebounceMs", v[0])}
        />
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Ruler className="w-3 h-3" />
            Baseline Reference
          </span>
          <span>
            {calibration.baselineReferencePx ? `${calibration.baselineReferencePx.toFixed(1)} px` : "Not set"}
          </span>
        </div>
        <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
          <span>Current Reference</span>
          <span>
            {calibration.currentReferencePx ? `${calibration.currentReferencePx.toFixed(1)} px` : "No hand"}
          </span>
        </div>
        <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
          <span>Effective Distance Factor</span>
          <span>{calibration.effectiveDistanceFactor.toFixed(2)}x</span>
        </div>
        <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Hand className="w-3 h-3" />
            Smoothed Handedness
          </span>
          <span>{leftCount}L / {rightCount}R</span>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCaptureCalibration}
            disabled={!isActive || hands.length === 0}
            className="flex-1 px-3 py-2 rounded-lg font-mono text-[11px] bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 disabled:opacity-40 transition-all"
          >
            Capture Baseline
          </button>
          <button
            onClick={onClearCalibration}
            className="px-3 py-2 rounded-lg font-mono text-[11px] bg-secondary/50 border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrackingCalibrationPanel;

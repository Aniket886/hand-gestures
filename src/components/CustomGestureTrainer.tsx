import { useMemo, useState } from "react";
import { Fingerprint, Save, Trash2, Plus, RefreshCcw } from "lucide-react";
import type { HandData } from "@/hooks/useHandTracking";
import { createGestureSampleVector, type CustomGestureProfile } from "@/lib/customGestures";

interface CustomGestureTrainerProps {
  isActive: boolean;
  hands: HandData[];
  profiles: CustomGestureProfile[];
  onCreateProfile: (label: string, emoji: string, samples: number[][]) => { id: string } | null;
  onDeleteProfile: (id: string) => void;
}

const DEFAULT_EMOJIS = ["🖐️", "👋", "✌️", "🤟", "👌", "🤘", "👉", "🤙", "🫶", "🎯"];

const CustomGestureTrainer = ({
  isActive,
  hands,
  profiles,
  onCreateProfile,
  onDeleteProfile,
}: CustomGestureTrainerProps) => {
  const [label, setLabel] = useState("");
  const [emoji, setEmoji] = useState("🖐️");
  const [samples, setSamples] = useState<number[][]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const canRecord = isActive && hands.length > 0;
  const canSave = label.trim().length > 1 && samples.length >= 2;

  const primaryHand = useMemo(() => hands[0]?.landmarks ?? null, [hands]);

  const addSample = () => {
    if (!primaryHand) {
      setMessage("Start camera and keep one hand in frame.");
      return;
    }
    const vector = createGestureSampleVector(primaryHand as { x: number; y: number; z: number }[]);
    if (!vector.length) {
      setMessage("Unable to read landmarks for this frame.");
      return;
    }
    setSamples((prev) => [...prev, vector]);
    setMessage(`Captured sample ${samples.length + 1}.`);
  };

  const resetDraft = () => {
    setSamples([]);
    setMessage("Draft cleared.");
  };

  const saveGesture = () => {
    const created = onCreateProfile(label.trim(), emoji, samples);
    if (!created) {
      setMessage("Need a label and at least 2 samples.");
      return;
    }
    setLabel("");
    setEmoji("🖐️");
    setSamples([]);
    setMessage("Custom gesture saved.");
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Fingerprint className="w-4 h-4 text-primary" />
        <h3 className="font-mono text-xs font-bold text-foreground uppercase tracking-wider">Custom Gesture Trainer</h3>
      </div>

      <div className="space-y-2">
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Gesture name (example: salute)"
          className="w-full bg-background border border-border rounded-lg px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary/50 transition-all"
        />
        <div className="flex gap-1.5 flex-wrap">
          {DEFAULT_EMOJIS.map((value) => (
            <button
              key={value}
              onClick={() => setEmoji(value)}
              className={`w-8 h-8 rounded-md border transition-all ${
                emoji === value
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:border-primary/40"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={addSample}
          disabled={!canRecord}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-mono text-[11px] bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 disabled:opacity-40 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Record Sample ({samples.length})
        </button>
        <button
          onClick={resetDraft}
          disabled={samples.length === 0}
          className="px-3 py-2 rounded-lg font-mono text-[11px] bg-secondary/50 border border-border text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40 transition-all"
        >
          <RefreshCcw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={saveGesture}
          disabled={!canSave}
          className="px-3 py-2 rounded-lg font-mono text-[11px] bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 disabled:opacity-40 transition-all flex items-center gap-1.5"
        >
          <Save className="w-3.5 h-3.5" />
          Save
        </button>
      </div>

      {message && <p className="font-mono text-[10px] text-muted-foreground">{message}</p>}

      <div className="border-t border-border pt-3 space-y-2">
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          Saved custom gestures ({profiles.length})
        </p>
        {profiles.length === 0 && (
          <p className="font-mono text-[11px] text-muted-foreground">No custom gestures saved yet.</p>
        )}
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className="flex items-center justify-between bg-secondary/20 border border-border rounded-lg px-3 py-2"
          >
            <div className="min-w-0">
              <p className="font-mono text-xs text-foreground truncate">
                {profile.emoji} {profile.label}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {profile.samples.length} samples
              </p>
            </div>
            <button
              onClick={() => onDeleteProfile(profile.id)}
              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomGestureTrainer;

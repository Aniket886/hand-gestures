import { Volume2, VolumeX, Vibrate, Mic, MicOff, Smartphone } from "lucide-react";
import type { FeedbackSettings } from "@/lib/feedback";

interface FeedbackControlsProps {
  settings: FeedbackSettings;
  onChange: (settings: FeedbackSettings) => void;
}

const FeedbackControls = ({ settings, onChange }: FeedbackControlsProps) => {
  const toggles = [
    {
      key: "soundEnabled" as const,
      label: "Sound",
      iconOn: Volume2,
      iconOff: VolumeX,
    },
    {
      key: "hapticEnabled" as const,
      label: "Haptic",
      iconOn: Smartphone,
      iconOff: Smartphone,
    },
    {
      key: "voiceEnabled" as const,
      label: "Voice",
      iconOn: Mic,
      iconOff: MicOff,
    },
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-4 mt-4">
      <h3 className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-3">
        Feedback
      </h3>
      <div className="flex gap-2">
        {toggles.map(({ key, label, iconOn, iconOff }) => {
          const active = settings[key];
          const Icon = active ? iconOn : iconOff;
          return (
            <button
              key={key}
              onClick={() => onChange({ ...settings, [key]: !active })}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-[10px] uppercase tracking-wider transition-all duration-200 ${
                active
                  ? "bg-primary/10 border border-primary/30 text-primary"
                  : "bg-secondary/30 border border-transparent text-muted-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FeedbackControls;

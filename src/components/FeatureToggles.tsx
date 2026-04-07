import { PenTool, Navigation, Volume2, VolumeX, Mic, MicOff, Smartphone, Eye, EyeOff } from "lucide-react";

export interface FeatureFlags {
  airWriting: boolean;
  gestureNavigation: boolean;
  handOverlay: boolean;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  voiceEnabled: boolean;
}

interface FeatureTogglesProps {
  flags: FeatureFlags;
  onChange: (flags: FeatureFlags) => void;
}

const TOGGLES: {
  key: keyof FeatureFlags;
  label: string;
  iconOn: React.ElementType;
  iconOff: React.ElementType;
  group: "features" | "feedback";
}[] = [
  { key: "gestureNavigation", label: "Gestures", iconOn: Navigation, iconOff: Navigation, group: "features" },
  { key: "airWriting", label: "Drawing", iconOn: PenTool, iconOff: PenTool, group: "features" },
  { key: "handOverlay", label: "Skeleton", iconOn: Eye, iconOff: EyeOff, group: "features" },
  { key: "soundEnabled", label: "Sound", iconOn: Volume2, iconOff: VolumeX, group: "feedback" },
  { key: "hapticEnabled", label: "Haptic", iconOn: Smartphone, iconOff: Smartphone, group: "feedback" },
  { key: "voiceEnabled", label: "Voice", iconOn: Mic, iconOff: MicOff, group: "feedback" },
];

const FeatureToggles = ({ flags, onChange }: FeatureTogglesProps) => {
  const toggle = (key: keyof FeatureFlags) =>
    onChange({ ...flags, [key]: !flags[key] });

  const renderGroup = (group: "features" | "feedback", title: string) => (
    <div>
      <h4 className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-2">
        {title}
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {TOGGLES.filter((t) => t.group === group).map(({ key, label, iconOn, iconOff }) => {
          const active = flags[key];
          const Icon = active ? iconOn : iconOff;
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-wider transition-all duration-200 ${
                active
                  ? "bg-primary/10 border border-primary/30 text-primary"
                  : "bg-secondary/30 border border-transparent text-muted-foreground line-through opacity-60"
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="bg-card border border-border rounded-xl p-4 mt-4 space-y-3">
      <h3 className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
        Controls
      </h3>
      {renderGroup("features", "Features")}
      {renderGroup("feedback", "Feedback")}
    </div>
  );
};

export default FeatureToggles;

import { Mic, MicOff, Radio, Terminal } from "lucide-react";

interface VoiceAssistantPanelProps {
  isSupported: boolean;
  isListening: boolean;
  lastHeard: string;
  lastResponse: string;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
}

const VoiceAssistantPanel = ({
  isSupported,
  isListening,
  lastHeard,
  lastResponse,
  error,
  onStart,
  onStop,
}: VoiceAssistantPanelProps) => {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary" />
          <h3 className="font-mono text-xs font-bold text-foreground uppercase tracking-wider">Voice Assistant</h3>
        </div>
        <button
          onClick={isListening ? onStop : onStart}
          disabled={!isSupported}
          className={`px-3 py-1.5 rounded-lg font-mono text-[11px] border transition-all flex items-center gap-1.5 ${
            isListening
              ? "bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20"
              : "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
          } disabled:opacity-40`}
        >
          {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          {isListening ? "Stop" : "Start"}
        </button>
      </div>

      {!isSupported && (
        <p className="font-mono text-[11px] text-muted-foreground">
          Speech recognition is not supported in this browser.
        </p>
      )}

      <div className="bg-secondary/20 border border-border rounded-lg p-3 space-y-1.5">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Wake Phrase</p>
        <p className="font-mono text-xs text-foreground">Arc</p>
      </div>

      <div className="bg-secondary/20 border border-border rounded-lg p-3 space-y-1.5">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Last Heard</p>
        <p className="font-mono text-xs text-foreground break-words">{lastHeard || "-"}</p>
      </div>

      <div className="bg-secondary/20 border border-border rounded-lg p-3 space-y-1.5">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Assistant Reply</p>
        <p className="font-mono text-xs text-foreground break-words">{lastResponse || "-"}</p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-2">
          <p className="font-mono text-[10px] text-destructive">{error}</p>
        </div>
      )}

      <div className="bg-secondary/20 border border-border rounded-lg p-3 space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Terminal className="w-3 h-3" />
          Voice Commands
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">Arc, start tracking</p>
        <p className="font-mono text-[10px] text-muted-foreground">Arc, stop tracking</p>
        <p className="font-mono text-[10px] text-muted-foreground">Arc, next slide</p>
        <p className="font-mono text-[10px] text-muted-foreground">Arc, previous slide</p>
        <p className="font-mono text-[10px] text-muted-foreground">Arc, enable calibration</p>
      </div>
    </div>
  );
};

export default VoiceAssistantPanel;

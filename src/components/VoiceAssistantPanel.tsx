import { Mic, MicOff, Radio, Terminal } from "lucide-react";
import type { ArcLogEntry } from "@/lib/arcLogger";

interface VoiceAssistantPanelProps {
  isSupported: boolean;
  isEnabled: boolean;
  status: string;
  lastHeard: string;
  lastResponse: string;
  error: string | null;
  logs: ArcLogEntry[];
  onStart: () => void;
  onStop: () => void;
}

const VoiceAssistantPanel = ({
  isSupported,
  isEnabled,
  status,
  lastHeard,
  lastResponse,
  error,
  logs,
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
          onClick={isEnabled ? onStop : onStart}
          disabled={!isSupported}
          className={`px-3 py-1.5 rounded-lg font-mono text-[11px] border transition-all flex items-center gap-1.5 ${
            isEnabled
              ? "bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20"
              : "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
          } disabled:opacity-40`}
        >
          {isEnabled ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          {isEnabled ? "Stop" : "Start"}
        </button>
      </div>

      <div className="bg-secondary/20 border border-border rounded-lg p-3 space-y-1.5">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Status</p>
        <p className="font-mono text-xs text-foreground capitalize">{status.replaceAll("_", " ")}</p>
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

      <div className="bg-secondary/20 border border-border rounded-lg p-3 space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Recent Logs</p>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="font-mono text-[10px] text-muted-foreground">No logs yet.</p>
          ) : (
            logs.slice(-8).reverse().map((entry, index) => (
              <div key={`${entry.timestamp}-${entry.action}-${index}`} className="rounded-md border border-border/60 bg-background/50 px-2 py-1.5">
                <p className="font-mono text-[10px] text-foreground">
                  {entry.state} · {entry.action}
                </p>
                {entry.transcript && (
                  <p className="font-mono text-[10px] text-muted-foreground break-words">{entry.transcript}</p>
                )}
                {entry.detail && (
                  <p className="font-mono text-[10px] text-muted-foreground break-words">{entry.detail}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceAssistantPanel;

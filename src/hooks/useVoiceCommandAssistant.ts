import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type VoiceCommandId =
  | "start_tracking"
  | "stop_tracking"
  | "next_slide"
  | "prev_slide"
  | "capture_calibration"
  | "open_presentation"
  | "open_playground"
  | "go_home"
  | "help";

export interface VoiceCommand {
  id: VoiceCommandId;
  text: string;
}

interface VoiceAssistantOptions {
  wakePhrase?: string;
  wakeAliases?: string[];
  wakeWindowMs?: number;
  onCommand: (command: VoiceCommand) => void;
  onQuery?: (prompt: string) => void | Promise<void>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart?: (() => void) | null;
  onaudiostart?: (() => void) | null;
  onsoundstart?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onspeechend?: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal?: boolean;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
  resultIndex?: number;
}

interface SpeechRecognitionErrorEventLike {
  error?: string;
}

export function normalizeTranscript(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

export function parseVoiceCommand(text: string): VoiceCommand | null {
  if (!text) return null;

  const startPatterns = [
    "start tracking",
    "start camera",
    "start detection",
    "start",
    "begin",
    "turn on tracking",
    "turn on camera",
    "enable tracking",
    "enable camera",
  ];
  const stopPatterns = [
    "stop tracking",
    "stop camera",
    "stop detection",
    "stop",
    "end",
    "turn off tracking",
    "turn off camera",
    "disable tracking",
    "disable camera",
  ];
  const nextPatterns = ["next slide", "next", "forward"];
  const prevPatterns = ["previous slide", "prev slide", "back slide", "previous", "prev", "back"];
  const calibrationPatterns = [
    "enable calibration",
    "capture calibration",
    "calibrate now",
    "save calibration",
    "calibrate",
  ];

  if (includesAny(text, startPatterns)) {
    return { id: "start_tracking", text };
  }
  if (includesAny(text, stopPatterns)) {
    return { id: "stop_tracking", text };
  }
  if (includesAny(text, nextPatterns)) {
    return { id: "next_slide", text };
  }
  if (includesAny(text, prevPatterns)) {
    return { id: "prev_slide", text };
  }
  if (includesAny(text, calibrationPatterns)) {
    return { id: "capture_calibration", text };
  }
  if (text.includes("open presentation") || text.includes("presentation mode")) {
    return { id: "open_presentation", text };
  }
  if (text.includes("open playground") || text.includes("open play mode") || text.includes("open game")) {
    return { id: "open_playground", text };
  }
  if (text.includes("go home") || text.includes("open home") || text.includes("dashboard")) {
    return { id: "go_home", text };
  }
  if (text.includes("help") || text.includes("show commands")) {
    return { id: "help", text };
  }

  return null;
}

export function findWakeWord(
  normalizedTranscript: string,
  wakeWords: string[]
): { hasWake: boolean; afterWake: string } {
  if (!normalizedTranscript) return { hasWake: false, afterWake: "" };

  for (const wakeWord of wakeWords) {
    const escaped = wakeWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    const match = regex.exec(normalizedTranscript);
    if (!match || match.index < 0) continue;

    const afterWake = normalizedTranscript.slice(match.index + match[0].length).trim();
    return { hasWake: true, afterWake };
  }

  return { hasWake: false, afterWake: "" };
}

export function interpretTranscript(args: {
  transcript: string;
  nowMs: number;
  armedUntilMs: number;
  wakeWords: string[];
  wakeWindowMs: number;
}): { nextArmedUntilMs: number; command: VoiceCommand | null; isWakeOnly: boolean; normalized: string } {
  const normalized = normalizeTranscript(args.transcript);
  const wake = findWakeWord(normalized, args.wakeWords);

  const withinWakeWindow = args.armedUntilMs > 0 && args.nowMs <= args.armedUntilMs;

  if (wake.hasWake) {
    const commandText = wake.afterWake.trim();
    if (!commandText) {
      return {
        nextArmedUntilMs: args.nowMs + args.wakeWindowMs,
        command: null,
        isWakeOnly: true,
        normalized,
      };
    }
    const command = parseVoiceCommand(commandText);
    return {
      nextArmedUntilMs: command ? 0 : args.nowMs + args.wakeWindowMs,
      command,
      isWakeOnly: false,
      normalized,
    };
  }

  if (withinWakeWindow) {
    const command = parseVoiceCommand(normalized);
    return {
      nextArmedUntilMs: command ? 0 : args.armedUntilMs,
      command,
      isWakeOnly: false,
      normalized,
    };
  }

  return { nextArmedUntilMs: args.armedUntilMs, command: null, isWakeOnly: false, normalized };
}

export function isQuestionLike(normalized: string): boolean {
  const cues = [
    "what",
    "who",
    "why",
    "how",
    "when",
    "where",
    "which",
    "can you",
    "do you know",
    "tell me",
    "define",
    "explain",
    "meaning of",
  ];
  return cues.some((cue) => normalized.includes(cue));
}

function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 0.85;
  window.speechSynthesis.speak(utterance);
}

export function useVoiceCommandAssistant({
  wakePhrase = "arc",
  wakeAliases = ["arc", "ark", "are"],
  wakeWindowMs = 6000,
  onCommand,
  onQuery,
}: VoiceAssistantOptions) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lastHeard, setLastHeard] = useState("");
  const [lastResponse, setLastResponse] = useState("Idle");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const manualStopRef = useRef(false);
  const wakePhraseRef = useRef(wakePhrase);
  wakePhraseRef.current = wakePhrase;
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;
  const onQueryRef = useRef<typeof onQuery>(onQuery);
  onQueryRef.current = onQuery;
  const armedUntilRef = useRef(0);
  const [armedUntilMs, setArmedUntilMs] = useState(0);
  const lastProcessedRef = useRef<string>("");
  const lastWakeAckAtRef = useRef(0);

  const wakeWords = useMemo(() => {
    const all = [wakePhrase, ...wakeAliases].map((w) => normalizeTranscript(w)).filter(Boolean);
    return Array.from(new Set(all));
  }, [wakeAliases, wakePhrase]);

  useEffect(() => {
    const win = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const RecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    setIsSupported(Boolean(RecognitionCtor));
    if (!RecognitionCtor) return;

    const recognition = new RecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    if (typeof recognition.maxAlternatives === "number") recognition.maxAlternatives = 3;
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let fullTranscript = "";
      let sawFinal = false;
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const chunk = String(result?.[0]?.transcript || "").trim();
        if (!chunk) continue;
        fullTranscript = fullTranscript ? `${fullTranscript} ${chunk}` : chunk;
        if (result?.isFinal) sawFinal = true;
      }
      if (!fullTranscript) return;

      const normalizedFull = normalizeTranscript(fullTranscript);
      if (normalizedFull && normalizedFull === lastProcessedRef.current && !sawFinal) {
        return;
      }
      if (normalizedFull) lastProcessedRef.current = normalizedFull;

      setLastHeard(fullTranscript.trim());
      const now = Date.now();

      const interpreted = interpretTranscript({
        transcript: fullTranscript,
        nowMs: now,
        armedUntilMs: armedUntilRef.current,
        wakeWords,
        wakeWindowMs,
      });
      if (interpreted.nextArmedUntilMs !== armedUntilRef.current) {
        armedUntilRef.current = interpreted.nextArmedUntilMs;
        setArmedUntilMs(interpreted.nextArmedUntilMs);
      }

      if (interpreted.isWakeOnly) {
        setLastResponse("Yes?");
        // Acknowledge wake once per short interval (interim results can repeat wake).
        if (now - lastWakeAckAtRef.current > 1200) {
          lastWakeAckAtRef.current = now;
          speak("Yes?");
        }
        return;
      }

      if (interpreted.command) {
        setLastResponse(`Command: ${interpreted.command.id.replaceAll("_", " ")}`);
        if (sawFinal) onCommandRef.current(interpreted.command);
        return;
      }

      // If we got here, we're either within wake window or the user said Arc + unknown phrase.
      // Treat it as a free-form query for the app to handle (e.g. Groq).
      const isWakeOrArmed = interpreted.normalized.length > 0 && armedUntilRef.current > 0;
      if (isWakeOrArmed && onQueryRef.current) {
        const prompt = interpreted.normalized;
        if (!sawFinal) return;
        if (isQuestionLike(prompt)) {
          setLastResponse("Thinking...");
          void Promise.resolve(onQueryRef.current(prompt)).catch(() => {
            setLastResponse("Unable to answer right now.");
          });
        } else {
          setLastResponse('Try: "Arc start tracking", "Arc stop tracking", or "Arc help".');
        }
      }
    };

    recognition.onstart = () => {
      setError(null);
      setLastResponse(`Listening for "${wakePhraseRef.current}"...`);
    };
    recognition.onaudiostart = () => {
      setLastResponse("Mic active...");
    };
    recognition.onspeechstart = () => {
      setLastResponse("Hearing speech...");
    };
    recognition.onspeechend = () => {
      setLastResponse(`Listening for "${wakePhrase}"...`);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      const code = event?.error || "unknown";
      if (code === "aborted") {
        // Common during start/stop transitions or re-initialization; don't show as a user error.
        return;
      }
      if (code === "not-allowed" || code === "service-not-allowed") {
        manualStopRef.current = true;
        recognition.stop();
        setIsListening(false);
        setError("Microphone permission blocked. Allow mic access and try again.");
        setLastResponse("Mic permission blocked.");
        return;
      }

      if (code === "audio-capture") {
        manualStopRef.current = true;
        recognition.stop();
        setIsListening(false);
        setError("No microphone found. Connect a mic and try again.");
        setLastResponse("No microphone found.");
        return;
      }

      // Transient errors: keep trying via onend auto-restart.
      const message = event?.error ? `Voice error: ${event.error}` : "Voice recognition error";
      setError(message);
    };

    recognition.onend = () => {
      if (!manualStopRef.current) {
        try {
          recognition.start();
          setIsListening(true);
        } catch {
          setIsListening(false);
        }
      }
    };

    return () => {
      manualStopRef.current = true;
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [wakeWords, wakeWindowMs]);

  useEffect(() => {
    if (!armedUntilMs) return;
    const interval = window.setInterval(() => {
      if (armedUntilRef.current && Date.now() > armedUntilRef.current) {
        armedUntilRef.current = 0;
        setArmedUntilMs(0);
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [armedUntilMs]);

  const isArmed = armedUntilMs > 0 && Date.now() <= armedUntilMs;
  const armedMsRemaining = isArmed ? Math.max(0, armedUntilMs - Date.now()) : 0;

  const respond = useCallback((message: string, withVoice = true) => {
    setLastResponse(message);
    if (withVoice) speak(message);
  }, []);

  const disarm = useCallback(() => {
    armedUntilRef.current = 0;
    setArmedUntilMs(0);
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return false;
    try {
      manualStopRef.current = false;
      recognitionRef.current.start();
      setIsListening(true);
      setError(null);
      setLastResponse(`Listening for "${wakePhrase}"...`);
      return true;
    } catch {
      setError("Unable to start voice recognition");
      setIsListening(false);
      return false;
    }
  }, [wakePhrase]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    manualStopRef.current = true;
    recognitionRef.current.stop();
    setIsListening(false);
    setLastResponse("Voice assistant paused.");
  }, []);

  return useMemo(
    () => ({
      isSupported,
      isListening,
      isArmed,
      armedMsRemaining,
      lastHeard,
      lastResponse,
      error,
      startListening,
      stopListening,
      respond,
      disarm,
    }),
    [
      armedMsRemaining,
      error,
      isArmed,
      isListening,
      isSupported,
      lastHeard,
      lastResponse,
      respond,
      startListening,
      stopListening,
      disarm,
    ]
  );
}

// Backwards-compat: keep the old name as an alias for any internal imports.
export const parseCommand = parseVoiceCommand;

// --- Remove old implementation (kept for git history only) ---
/*
function parseCommand(text: string): VoiceCommand | null {
  return parseVoiceCommand(text);
}
*/

/*
  if (!command) {
        const message = `I heard "${commandText}", but that command is not supported yet.`;
        setLastResponse(message);
        speak("Command not recognized");
        return;
      }

      onCommand(command);
*/

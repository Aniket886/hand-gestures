import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  findWakeWord,
  isQuestionLike,
  normalizeTranscript,
  parseVoiceCommand,
  type VoiceCommand,
} from "@/hooks/useVoiceCommandAssistant";

type ArcStatus = "idle" | "listening" | "armed" | "executing_command" | "querying" | "speaking" | "error";

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart?: (() => void) | null;
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

interface HomeArcHandlers {
  startTracking?: () => void | Promise<void>;
  stopTracking?: () => void | Promise<void>;
  captureCalibration?: () => boolean | Promise<boolean>;
}

interface PresentationArcHandlers {
  nextSlide?: () => void | Promise<void>;
  prevSlide?: () => void | Promise<void>;
}

interface ArcContextValue {
  isSupported: boolean;
  isEnabled: boolean;
  isListening: boolean;
  status: ArcStatus;
  lastHeard: string;
  lastResponse: string;
  error: string | null;
  enableArc: () => void;
  disableArc: () => void;
  resetArc: () => void;
  registerHomeHandlers: (handlers: HomeArcHandlers) => () => void;
  registerPresentationHandlers: (handlers: PresentationArcHandlers) => () => void;
}

const STORAGE_KEY = "arc-enabled";
const WAKE_WORDS = ["arc", "ark", "are"];
const WAKE_WINDOW_MS = 6000;

const ArcContext = createContext<ArcContextValue | null>(null);

function collectTranscriptWindow(event: SpeechRecognitionEventLike) {
  const startIndex = typeof event.resultIndex === "number" ? event.resultIndex : 0;
  let transcript = "";
  let sawFinal = false;

  for (let index = startIndex; index < event.results.length; index++) {
    const result = event.results[index];
    const chunk = String(result?.[0]?.transcript || "").trim();
    if (!chunk) continue;
    transcript = transcript ? `${transcript} ${chunk}` : chunk;
    if (result?.isFinal) sawFinal = true;
  }

  return {
    transcript: transcript.trim(),
    normalized: normalizeTranscript(transcript),
    sawFinal,
  };
}

function isFatalRecognitionError(code?: string) {
  return code === "not-allowed" || code === "service-not-allowed" || code === "audio-capture";
}

export function ArcProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState<ArcStatus>("idle");
  const [lastHeard, setLastHeard] = useState("");
  const [lastResponse, setLastResponse] = useState("Idle");
  const [error, setError] = useState<string | null>(null);
  const isEnabledRef = useRef(isEnabled);
  isEnabledRef.current = isEnabled;
  const errorRef = useRef(error);
  errorRef.current = error;

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const homeHandlersRef = useRef<HomeArcHandlers>({});
  const presentationHandlersRef = useRef<PresentationArcHandlers>({});
  const pendingCommandRef = useRef<VoiceCommand | null>(null);
  const armedUntilRef = useRef(0);
  const userStoppedRef = useRef(false);
  const pauseForSpeechRef = useRef(false);
  const isStartingRef = useRef(false);
  const lastProcessedFinalRef = useRef("");
  const lastWakeAckAtRef = useRef(0);
  const lastSpokenTextRef = useRef("");
  const speechEndCleanupRef = useRef<(() => void) | null>(null);
  const runCommandRef = useRef<(command: VoiceCommand) => Promise<void>>();
  const answerQueryRef = useRef<(prompt: string) => Promise<void>>();

  const clearInteractionState = useCallback(() => {
    armedUntilRef.current = 0;
    pendingCommandRef.current = null;
    lastProcessedFinalRef.current = "";
  }, []);

  const syncStatusFromState = useCallback(() => {
    if (!isEnabledRef.current) {
      setStatus("idle");
      return;
    }
    if (errorRef.current) {
      setStatus("error");
      return;
    }
    if (Date.now() <= armedUntilRef.current) {
      setStatus("armed");
      return;
    }
    setStatus("listening");
  }, []);

  const startRecognition = useCallback(() => {
    if (!recognitionRef.current || isStartingRef.current || pauseForSpeechRef.current) return;
    try {
      isStartingRef.current = true;
      userStoppedRef.current = false;
      recognitionRef.current.start();
    } catch {
      isStartingRef.current = false;
    }
  }, []);

  const stopRecognition = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // no-op
    }
  }, []);

  const speakAndResume = useCallback(
    async (message: string) => {
      setLastResponse(message);
      if (!("speechSynthesis" in window)) {
        syncStatusFromState();
        return;
      }

      setStatus("speaking");
      lastSpokenTextRef.current = normalizeTranscript(message);
      pauseForSpeechRef.current = true;
      stopRecognition();
      window.speechSynthesis.cancel();

      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 0.85;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      });

      pauseForSpeechRef.current = false;
      speechEndCleanupRef.current?.();
      speechEndCleanupRef.current = null;
      if (isEnabledRef.current && !errorRef.current) startRecognition();
      syncStatusFromState();
    },
    [startRecognition, stopRecognition, syncStatusFromState]
  );

  const executePendingIfReady = useCallback(async () => {
    const pending = pendingCommandRef.current;
    if (!pending) return;

    if (
      (pending.id === "start_tracking" || pending.id === "stop_tracking" || pending.id === "capture_calibration") &&
      location.pathname === "/" &&
      (homeHandlersRef.current.startTracking || homeHandlersRef.current.stopTracking || homeHandlersRef.current.captureCalibration)
    ) {
      pendingCommandRef.current = null;
    } else if (
      (pending.id === "next_slide" || pending.id === "prev_slide") &&
      location.pathname === "/present" &&
      (presentationHandlersRef.current.nextSlide || presentationHandlersRef.current.prevSlide)
    ) {
      pendingCommandRef.current = null;
    } else {
      return;
    }

    await runCommandRef.current?.(pending);
  }, [location.pathname]);

  async function runCommand(command: VoiceCommand) {
    setStatus("executing_command");
    clearInteractionState();

    if (command.id === "start_tracking") {
      if (location.pathname !== "/") {
        pendingCommandRef.current = command;
        navigate("/");
        return;
      }
      await homeHandlersRef.current.startTracking?.();
      speechEndCleanupRef.current = syncStatusFromState;
      await speakAndResume("Starting tracking.");
      return;
    }

    if (command.id === "stop_tracking") {
      if (location.pathname !== "/") {
        pendingCommandRef.current = command;
        navigate("/");
        return;
      }
      await homeHandlersRef.current.stopTracking?.();
      speechEndCleanupRef.current = syncStatusFromState;
      await speakAndResume("Stopping tracking.");
      return;
    }

    if (command.id === "capture_calibration") {
      if (location.pathname !== "/") {
        pendingCommandRef.current = command;
        navigate("/");
        return;
      }
      const result = await homeHandlersRef.current.captureCalibration?.();
      speechEndCleanupRef.current = syncStatusFromState;
      await speakAndResume(result ? "Calibration captured." : "Show one hand clearly, then try calibration again.");
      return;
    }

    if (command.id === "next_slide") {
      if (location.pathname !== "/present") {
        pendingCommandRef.current = command;
        navigate("/present");
        return;
      }
      await presentationHandlersRef.current.nextSlide?.();
      speechEndCleanupRef.current = syncStatusFromState;
      await speakAndResume("Next slide.");
      return;
    }

    if (command.id === "prev_slide") {
      if (location.pathname !== "/present") {
        pendingCommandRef.current = command;
        navigate("/present");
        return;
      }
      await presentationHandlersRef.current.prevSlide?.();
      speechEndCleanupRef.current = syncStatusFromState;
      await speakAndResume("Previous slide.");
      return;
    }

    if (command.id === "open_presentation") {
      navigate("/present");
      speechEndCleanupRef.current = syncStatusFromState;
      await speakAndResume("Opening presentation mode.");
      return;
    }

    if (command.id === "open_playground") {
      navigate("/play");
      speechEndCleanupRef.current = syncStatusFromState;
      await speakAndResume("Opening playground mode.");
      return;
    }

    if (command.id === "go_home") {
      navigate("/");
      speechEndCleanupRef.current = syncStatusFromState;
      await speakAndResume("Returning home.");
      return;
    }

    speechEndCleanupRef.current = syncStatusFromState;
    await speakAndResume('Try "Arc start tracking", "Arc stop tracking", or ask a question.');
  }
  runCommandRef.current = runCommand;

  const answerQuery = useCallback(
    async (prompt: string) => {
      setStatus("querying");
      clearInteractionState();

      try {
        const res = await fetch("/api/arc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        const reply = res.ok ? (data?.text || "No answer.").trim() : data?.error ? `Error: ${data.error}` : "Unable to answer right now.";
        speechEndCleanupRef.current = syncStatusFromState;
        await speakAndResume(reply);
      } catch {
        speechEndCleanupRef.current = syncStatusFromState;
        await speakAndResume("Network error. Unable to reach Arc server.");
      }
    },
    [clearInteractionState, speakAndResume, syncStatusFromState]
  );
  answerQueryRef.current = answerQuery;

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

    recognition.onstart = () => {
      isStartingRef.current = false;
      setIsListening(true);
      setError(null);
      syncStatusFromState();
      setLastResponse((current) => (current === "Idle" ? 'Listening for "Arc"...' : current));
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      if (pauseForSpeechRef.current) return;

      const { transcript, normalized, sawFinal } = collectTranscriptWindow(event);
      if (!transcript) return;
      setLastHeard(transcript);

      const now = Date.now();
      const wake = findWakeWord(normalized, WAKE_WORDS);
      const armed = armedUntilRef.current > now;

      if (lastSpokenTextRef.current && normalized === lastSpokenTextRef.current) {
        return;
      }

      if (wake.hasWake && !wake.afterWake) {
        armedUntilRef.current = now + WAKE_WINDOW_MS;
        setStatus("armed");
        if (sawFinal && now - lastWakeAckAtRef.current > 1200) {
          lastWakeAckAtRef.current = now;
          speechEndCleanupRef.current = () => {
            if (Date.now() <= armedUntilRef.current) setStatus("armed");
            else syncStatusFromState();
          };
          void speakAndResume("Yes?");
        }
        return;
      }

      const actionable = wake.hasWake ? wake.afterWake.trim() : armed ? normalized : "";
      if (!actionable || !sawFinal) return;

      if (actionable === lastProcessedFinalRef.current) return;
      lastProcessedFinalRef.current = actionable;

      const command = parseVoiceCommand(actionable);
      if (command) {
        void runCommandRef.current?.(command);
        return;
      }

      if (isQuestionLike(actionable)) {
        void answerQueryRef.current?.(actionable);
        return;
      }

      clearInteractionState();
      speechEndCleanupRef.current = syncStatusFromState;
      void speakAndResume('Try "Arc start tracking", "Arc stop tracking", or "Arc help".');
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      const code = event?.error || "unknown";
      if (code === "aborted") return;

      if (isFatalRecognitionError(code)) {
        userStoppedRef.current = true;
        setIsListening(false);
        setStatus("error");
        if (code === "audio-capture") {
          setError("No microphone found. Connect a mic and try again.");
          setLastResponse("No microphone found.");
        } else {
          setError("Microphone permission blocked. Allow mic access and try again.");
          setLastResponse("Mic permission blocked.");
        }
        return;
      }

      setError(code ? `Voice error: ${code}` : "Voice recognition error");
    };

    recognition.onend = () => {
      isStartingRef.current = false;
      setIsListening(false);
      if (!userStoppedRef.current && !pauseForSpeechRef.current && !errorRef.current && isEnabledRef.current) {
        startRecognition();
      }
    };

    return () => {
      userStoppedRef.current = true;
      try {
        recognition.stop();
      } catch {
        // no-op
      }
      recognitionRef.current = null;
    };
  }, [clearInteractionState, navigate, speakAndResume, startRecognition, syncStatusFromState]);

  useEffect(() => {
    if (!isSupported) return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      setIsEnabled(true);
    }
  }, [isSupported]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(isEnabled));
    if (!isSupported) return;

    if (isEnabled) {
      startRecognition();
    } else {
      userStoppedRef.current = true;
      pauseForSpeechRef.current = false;
      window.speechSynthesis?.cancel();
      stopRecognition();
      setIsListening(false);
      clearInteractionState();
      setStatus("idle");
      setLastResponse("Arc paused.");
    }
  }, [clearInteractionState, isEnabled, isSupported, startRecognition, stopRecognition]);

  useEffect(() => {
    void executePendingIfReady();
  }, [executePendingIfReady, location.pathname]);

  const enableArc = useCallback(() => {
    setError(null);
    setIsEnabled(true);
    setStatus("listening");
    setLastResponse('Listening for "Arc"...');
  }, []);

  const disableArc = useCallback(() => {
    setIsEnabled(false);
  }, []);

  const resetArc = useCallback(() => {
    clearInteractionState();
    setLastHeard("");
    setError(null);
    syncStatusFromState();
  }, [clearInteractionState, syncStatusFromState]);

  const registerHomeHandlers = useCallback((handlers: HomeArcHandlers) => {
    homeHandlersRef.current = handlers;
    void executePendingIfReady();
    return () => {
      homeHandlersRef.current = {};
    };
  }, [executePendingIfReady]);

  const registerPresentationHandlers = useCallback((handlers: PresentationArcHandlers) => {
    presentationHandlersRef.current = handlers;
    void executePendingIfReady();
    return () => {
      presentationHandlersRef.current = {};
    };
  }, [executePendingIfReady]);

  const value = useMemo<ArcContextValue>(
    () => ({
      isSupported,
      isEnabled,
      isListening,
      status,
      lastHeard,
      lastResponse,
      error,
      enableArc,
      disableArc,
      resetArc,
      registerHomeHandlers,
      registerPresentationHandlers,
    }),
    [
      disableArc,
      enableArc,
      error,
      isEnabled,
      isListening,
      isSupported,
      lastHeard,
      lastResponse,
      registerHomeHandlers,
      registerPresentationHandlers,
      resetArc,
      status,
    ]
  );

  return <ArcContext.Provider value={value}>{children}</ArcContext.Provider>;
}

export function useArc() {
  const context = useContext(ArcContext);
  if (!context) {
    throw new Error("useArc must be used inside ArcProvider");
  }
  return context;
}

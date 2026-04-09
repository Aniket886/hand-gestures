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
import { logArcEvent } from "@/lib/arcLogger";
import { useArcUtteranceRecorder } from "@/hooks/useArcUtteranceRecorder";

type ArcStatus = "idle" | "listening" | "armed" | "recording" | "transcribing" | "executing_command" | "querying" | "speaking" | "error";

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
const WAKE_WINDOW_MS = 8000;
const COMMAND_DEBOUNCE_MS = 1500;
const RESTART_BACKOFF_MS = 400;

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

function isTransientRecognitionError(code?: string) {
  return code === "aborted" || code === "no-speech" || code === "network";
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
  const processingAudioRef = useRef(false);
  const isStartingRef = useRef(false);
  const lastProcessedFinalRef = useRef("");
  const lastWakeAckAtRef = useRef(0);
  const lastSpokenTextRef = useRef("");
  const speechEndCleanupRef = useRef<(() => void) | null>(null);
  const runCommandRef = useRef<(command: VoiceCommand) => Promise<void>>();
  const answerQueryRef = useRef<(prompt: string) => Promise<void>>();
  const lastCommandRef = useRef<{ id: VoiceCommand["id"]; at: number } | null>(null);
  const recognitionHealthRef = useRef<"healthy" | "transient" | "fatal">("healthy");
  const restartTimerRef = useRef<number | null>(null);
  const lastAnsweredPromptRef = useRef("");
  const wakeAcknowledgedAtRef = useRef(0);
  const { isRecording, recordUtterance, cancelRecording } = useArcUtteranceRecorder();

  const clearInteractionState = useCallback(() => {
    logArcEvent({ state: "reset", action: "clear_interaction_state" });
    armedUntilRef.current = 0;
    pendingCommandRef.current = null;
    lastProcessedFinalRef.current = "";
    lastAnsweredPromptRef.current = "";
  }, []);

  const toBase64 = useCallback(async (blob) => {
    const buffer = await blob.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let index = 0; index < bytes.byteLength; index++) {
      binary += String.fromCharCode(bytes[index]);
    }
    return window.btoa(binary);
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
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
    if (!recognitionRef.current || isStartingRef.current || pauseForSpeechRef.current || processingAudioRef.current) return;
    try {
      isStartingRef.current = true;
      userStoppedRef.current = false;
      logArcEvent({ state: "listening", action: "start_recognition" });
      recognitionRef.current.start();
    } catch {
      isStartingRef.current = false;
      logArcEvent({ state: "error", action: "start_recognition_failed" });
    }
  }, []);

  const stopRecognition = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      logArcEvent({ state: "idle", action: "stop_recognition" });
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
      logArcEvent({ state: "speaking", action: "speak_start", detail: message });
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
      logArcEvent({ state: "speaking", action: "speak_end", detail: message });
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
    logArcEvent({ state: "executing_command", action: command.id, transcript: command.text });
    clearInteractionState();

    if (command.id === "start_tracking") {
      if (location.pathname !== "/") {
        pendingCommandRef.current = command;
        navigate("/");
        return;
      }
      await homeHandlersRef.current.startTracking?.();
      speechEndCleanupRef.current = () => {
        clearInteractionState();
        logArcEvent({ state: "listening", action: "state_reset_after_command", detail: command.id });
        syncStatusFromState();
      };
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
      speechEndCleanupRef.current = () => {
        clearInteractionState();
        logArcEvent({ state: "listening", action: "state_reset_after_command", detail: command.id });
        syncStatusFromState();
      };
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
      speechEndCleanupRef.current = () => {
        clearInteractionState();
        logArcEvent({ state: "listening", action: "state_reset_after_command", detail: command.id });
        syncStatusFromState();
      };
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
      speechEndCleanupRef.current = () => {
        clearInteractionState();
        logArcEvent({ state: "listening", action: "state_reset_after_command", detail: command.id });
        syncStatusFromState();
      };
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
      speechEndCleanupRef.current = () => {
        clearInteractionState();
        logArcEvent({ state: "listening", action: "state_reset_after_command", detail: command.id });
        syncStatusFromState();
      };
      await speakAndResume("Previous slide.");
      return;
    }

    if (command.id === "open_presentation") {
      navigate("/present");
      speechEndCleanupRef.current = () => {
        clearInteractionState();
        logArcEvent({ state: "listening", action: "state_reset_after_command", detail: command.id });
        syncStatusFromState();
      };
      await speakAndResume("Opening presentation mode.");
      return;
    }

    if (command.id === "open_playground") {
      navigate("/play");
      speechEndCleanupRef.current = () => {
        clearInteractionState();
        logArcEvent({ state: "listening", action: "state_reset_after_command", detail: command.id });
        syncStatusFromState();
      };
      await speakAndResume("Opening playground mode.");
      return;
    }

    if (command.id === "go_home") {
      navigate("/");
      speechEndCleanupRef.current = () => {
        clearInteractionState();
        logArcEvent({ state: "listening", action: "state_reset_after_command", detail: command.id });
        syncStatusFromState();
      };
      await speakAndResume("Returning home.");
      return;
    }

    speechEndCleanupRef.current = () => {
      clearInteractionState();
      logArcEvent({ state: "listening", action: "state_reset_after_command", detail: command.id });
      syncStatusFromState();
    };
    await speakAndResume('Try "Arc start tracking", "Arc stop tracking", or ask a question.');
  }
  runCommandRef.current = runCommand;

  const answerQuery = useCallback(
    async (prompt: string) => {
      setStatus("querying");
      logArcEvent({ state: "querying", action: "query_start", transcript: prompt });
      clearInteractionState();

      try {
        const res = await fetch("/api/arc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        const reply = res.ok ? (data?.text || "No answer.").trim() : data?.error ? `Error: ${data.error}` : "Unable to answer right now.";
        logArcEvent({ state: "querying", action: "query_success", transcript: prompt, detail: reply });
        speechEndCleanupRef.current = () => {
          clearInteractionState();
          logArcEvent({ state: "listening", action: "state_reset_after_query", detail: prompt });
          syncStatusFromState();
        };
        await speakAndResume(reply);
      } catch {
        logArcEvent({ state: "error", action: "query_failed", transcript: prompt });
        speechEndCleanupRef.current = () => {
          clearInteractionState();
          logArcEvent({ state: "listening", action: "state_reset_after_query", detail: prompt });
          syncStatusFromState();
        };
        await speakAndResume("Network error. Unable to reach Arc server.");
      }
    },
    [clearInteractionState, speakAndResume, syncStatusFromState]
  );
  answerQueryRef.current = answerQuery;

  const handleTranscript = useCallback(
    async (transcript: string) => {
      const normalized = normalizeTranscript(transcript);
      if (!normalized) {
        speechEndCleanupRef.current = syncStatusFromState;
        await speakAndResume('I did not catch that. Say "Arc" and try again.');
        return;
      }

      setLastHeard(transcript);
      logArcEvent({ state: "transcribing", action: "server_transcript_used", transcript });

      const command = parseVoiceCommand(normalized);
      if (command) {
        void runCommandRef.current?.(command);
        return;
      }

      if (isQuestionLike(normalized)) {
        logArcEvent({ state: "querying", action: "query_routed", transcript });
        void answerQueryRef.current?.(normalized);
        return;
      }

      logArcEvent({ state: "armed", action: "query_rejected", transcript: normalized });
      speechEndCleanupRef.current = syncStatusFromState;
      await speakAndResume('Try "Arc start tracking", "Arc stop tracking", or ask a question.');
    },
    [answerQuery, normalizeTranscript, parseVoiceCommand, speakAndResume, syncStatusFromState]
  );

  const captureAndTranscribe = useCallback(async () => {
    if (processingAudioRef.current) return;
    processingAudioRef.current = true;
    setStatus("recording");
    setLastResponse("Listening...");
    logArcEvent({ state: "recording", action: "recording_started" });
    stopRecognition();

    const recording = await recordUtterance({ maxDurationMs: 6500, silenceMs: 1800, preRollMs: 800 });
    logArcEvent({ state: "recording", action: "recording_finished" });

    if (!recording || !recording.heardSpeech || !recording.blob || recording.blob.size === 0) {
      processingAudioRef.current = false;
      speechEndCleanupRef.current = syncStatusFromState;
      const message =
        recording?.stopReason === "empty"
          ? 'No clear speech detected. Say "Arc" and try again.'
          : "I could not capture your voice clearly. Please try again.";
      await speakAndResume(message);
      return;
    }

    setStatus("transcribing");
    setLastResponse("Transcribing...");
    logArcEvent({ state: "transcribing", action: "transcription_requested" });

    try {
      const audioBase64 = await toBase64(recording.blob);
      const response = await fetch("/api/arc-transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64,
          mimeType: recording.mimeType,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { text?: string; error?: string };

      if (!response.ok || !data?.text) {
        processingAudioRef.current = false;
        logArcEvent({ state: "error", action: "transcription_failed", detail: data?.error || "unknown" });
        speechEndCleanupRef.current = syncStatusFromState;
        await speakAndResume("I could not transcribe that clearly. Please try again.");
        return;
      }

      logArcEvent({ state: "transcribing", action: "transcription_success", transcript: data.text });
      processingAudioRef.current = false;
      await handleTranscript(data.text);
    } catch (error) {
      processingAudioRef.current = false;
      logArcEvent({ state: "error", action: "transcription_failed", detail: String(error) });
      speechEndCleanupRef.current = syncStatusFromState;
      await speakAndResume("Transcription failed. Please try again.");
    }
  }, [handleTranscript, recordUtterance, speakAndResume, stopRecognition, syncStatusFromState, toBase64]);

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
    recognition.lang = "en-IN";
    logArcEvent({ state: "listening", action: "recognition_lang_en_in" });
    if (typeof recognition.maxAlternatives === "number") recognition.maxAlternatives = 3;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      isStartingRef.current = false;
      setIsListening(true);
      setError(null);
       recognitionHealthRef.current = "healthy";
      logArcEvent({ state: "listening", action: "recognition_started" });
      syncStatusFromState();
      setLastResponse((current) => (current === "Idle" ? 'Listening for "Arc"...' : current));
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      if (pauseForSpeechRef.current) return;

      const { transcript, normalized, sawFinal } = collectTranscriptWindow(event);
      if (!transcript) return;
      setLastHeard(transcript);
      logArcEvent({ state: status, action: "transcript", transcript });

      const now = Date.now();
      const wake = findWakeWord(normalized, WAKE_WORDS);

      if (lastSpokenTextRef.current && normalized === lastSpokenTextRef.current) {
        return;
      }

      if (processingAudioRef.current) return;

      if (wake.hasWake && !sawFinal) {
        armedUntilRef.current = Math.max(armedUntilRef.current, now + WAKE_WINDOW_MS);
        setStatus("armed");
      }

      if (wake.hasWake) {
        armedUntilRef.current = now + WAKE_WINDOW_MS;
        setStatus("armed");
        logArcEvent({ state: "armed", action: "wake_detected_local", transcript });
        if (now - wakeAcknowledgedAtRef.current > 1200) {
          wakeAcknowledgedAtRef.current = now;
          void captureAndTranscribe();
        }
        return;
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      const code = event?.error || "unknown";
      if (isTransientRecognitionError(code)) {
        recognitionHealthRef.current = "transient";
        logArcEvent({ state: "listening", action: "recognition_error_transient", detail: code });
        setError(null);
        if (isEnabledRef.current) {
          syncStatusFromState();
        }
        return;
      }

      if (isFatalRecognitionError(code)) {
        userStoppedRef.current = true;
        setIsListening(false);
        setStatus("error");
        recognitionHealthRef.current = "fatal";
        logArcEvent({ state: "error", action: "recognition_error_fatal", detail: code });
        if (code === "audio-capture") {
          setError("No microphone found. Connect a mic and try again.");
          setLastResponse("No microphone found.");
        } else {
          setError("Microphone permission blocked. Allow mic access and try again.");
          setLastResponse("Mic permission blocked.");
        }
        return;
      }

      recognitionHealthRef.current = "transient";
      logArcEvent({ state: "listening", action: "recognition_error_transient", detail: code });
      setError(null);
    };

    recognition.onend = () => {
      isStartingRef.current = false;
      setIsListening(false);
      logArcEvent({ state: "idle", action: "recognition_ended" });
      if (
        !userStoppedRef.current &&
        !pauseForSpeechRef.current &&
        !processingAudioRef.current &&
        recognitionHealthRef.current !== "fatal" &&
        isEnabledRef.current
      ) {
        clearRestartTimer();
        logArcEvent({ state: "listening", action: "recognition_restart_scheduled", detail: `${RESTART_BACKOFF_MS}ms` });
        restartTimerRef.current = window.setTimeout(() => {
          logArcEvent({ state: "listening", action: "recognition_restart_success" });
          startRecognition();
        }, RESTART_BACKOFF_MS);
      }
    };

    return () => {
      userStoppedRef.current = true;
      clearRestartTimer();
      try {
        recognition.stop();
      } catch {
        // no-op
      }
      recognitionRef.current = null;
    };
  }, [clearInteractionState, clearRestartTimer, navigate, speakAndResume, startRecognition, syncStatusFromState]);

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
      recognitionHealthRef.current = "healthy";
      startRecognition();
    } else {
      userStoppedRef.current = true;
      pauseForSpeechRef.current = false;
      processingAudioRef.current = false;
      recognitionHealthRef.current = "healthy";
      clearRestartTimer();
      cancelRecording();
      window.speechSynthesis?.cancel();
      stopRecognition();
      setIsListening(false);
      clearInteractionState();
      setStatus("idle");
      setLastResponse("Arc paused.");
    }
  }, [clearInteractionState, clearRestartTimer, isEnabled, isSupported, startRecognition, stopRecognition]);

  useEffect(() => {
    if (!isEnabled) return;
    if (status !== "armed") return;

    const remainingMs = armedUntilRef.current - Date.now();
    if (remainingMs <= 0) {
      clearInteractionState();
      setLastResponse('Listening for "Arc"...');
      syncStatusFromState();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      clearInteractionState();
      setLastResponse('Listening for "Arc"...');
      syncStatusFromState();
    }, remainingMs);

    return () => window.clearTimeout(timeoutId);
  }, [clearInteractionState, isEnabled, status, syncStatusFromState]);

  useEffect(() => {
    void executePendingIfReady();
  }, [executePendingIfReady, location.pathname]);

  const enableArc = useCallback(() => {
    setError(null);
    setIsEnabled(true);
    setStatus("listening");
    recognitionHealthRef.current = "healthy";
    setLastResponse('Listening for "Arc"...');
    logArcEvent({ state: "listening", action: "arc_enabled" });
  }, []);

  const disableArc = useCallback(() => {
    setIsEnabled(false);
    logArcEvent({ state: "idle", action: "arc_disabled" });
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

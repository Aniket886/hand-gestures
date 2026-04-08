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
  onCommand: (command: VoiceCommand) => void;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error?: string;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCommand(text: string): VoiceCommand | null {
  if (!text) return null;

  if (text.includes("start tracking") || text.includes("start camera") || text.includes("start detection")) {
    return { id: "start_tracking", text };
  }
  if (text.includes("stop tracking") || text.includes("stop camera") || text.includes("stop detection")) {
    return { id: "stop_tracking", text };
  }
  if (text.includes("next slide")) {
    return { id: "next_slide", text };
  }
  if (text.includes("previous slide") || text.includes("prev slide") || text.includes("back slide")) {
    return { id: "prev_slide", text };
  }
  if (
    text.includes("enable calibration") ||
    text.includes("capture calibration") ||
    text.includes("calibrate now") ||
    text.includes("save calibration")
  ) {
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

function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 0.85;
  window.speechSynthesis.speak(utterance);
}

export function useVoiceCommandAssistant({ wakePhrase = "arc", onCommand }: VoiceAssistantOptions) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lastHeard, setLastHeard] = useState("");
  const [lastResponse, setLastResponse] = useState("Idle");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const manualStopRef = useRef(false);

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
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const latest = event.results[event.results.length - 1];
      const transcript = String(latest?.[0]?.transcript || "");
      const normalized = normalize(transcript);
      setLastHeard(transcript.trim());

      const wake = normalize(wakePhrase);
      const wakeIndex = normalized.indexOf(wake);
      if (wakeIndex < 0) return;

      const commandText = normalized.slice(wakeIndex + wake.length).trim();
      if (!commandText) {
        setLastResponse(`Wake phrase "${wakePhrase}" detected.`);
        return;
      }

      const command = parseCommand(commandText);
      if (!command) {
        const message = `I heard "${commandText}", but that command is not supported yet.`;
        setLastResponse(message);
        speak("Command not recognized");
        return;
      }

      onCommand(command);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
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
  }, [onCommand, wakePhrase]);

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

  const respond = useCallback((message: string, withVoice = true) => {
    setLastResponse(message);
    if (withVoice) speak(message);
  }, []);

  return useMemo(
    () => ({
      isSupported,
      isListening,
      lastHeard,
      lastResponse,
      error,
      startListening,
      stopListening,
      respond,
    }),
    [error, isListening, isSupported, lastHeard, lastResponse, respond, startListening, stopListening]
  );
}

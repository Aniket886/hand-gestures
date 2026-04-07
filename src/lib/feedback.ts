// Audio feedback for gesture recognition using Web Audio API + Speech Synthesis

type FeedbackType = "confirm" | "navigate" | "stop" | "positive" | "negative";

const GESTURE_SOUNDS: Record<string, FeedbackType> = {
  pointing: "navigate",
  peace: "navigate",
  open_palm: "stop",
  fist: "confirm",
  thumbs_up: "positive",
  thumbs_down: "negative",
  swipe_left: "navigate",
  swipe_right: "navigate",
};

let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = "sine", gain = 0.15) {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(g).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

const SOUND_PROFILES: Record<FeedbackType, () => void> = {
  navigate: () => {
    playTone(880, 0.08, "sine", 0.12);
    setTimeout(() => playTone(1100, 0.12, "sine", 0.1), 80);
  },
  confirm: () => {
    playTone(440, 0.15, "triangle", 0.1);
  },
  stop: () => {
    playTone(660, 0.1, "sine", 0.1);
    setTimeout(() => playTone(660, 0.1, "sine", 0.08), 120);
  },
  positive: () => {
    playTone(523, 0.1, "sine", 0.1);
    setTimeout(() => playTone(659, 0.1, "sine", 0.1), 100);
    setTimeout(() => playTone(784, 0.15, "sine", 0.12), 200);
  },
  negative: () => {
    playTone(400, 0.15, "sawtooth", 0.06);
    setTimeout(() => playTone(300, 0.2, "sawtooth", 0.05), 150);
  },
};

function triggerHaptic(pattern: number | number[] = 50) {
  if ("vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

let lastSpokenGesture = "";
let speechTimeout: ReturnType<typeof setTimeout> | null = null;

function speakGesture(label: string) {
  if (label === lastSpokenGesture) return;
  lastSpokenGesture = label;

  if (speechTimeout) clearTimeout(speechTimeout);
  speechTimeout = setTimeout(() => {
    lastSpokenGesture = "";
  }, 3000);

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(label);
    utterance.rate = 1.3;
    utterance.pitch = 1.1;
    utterance.volume = 0.6;
    window.speechSynthesis.speak(utterance);
  }
}

export interface FeedbackSettings {
  soundEnabled: boolean;
  hapticEnabled: boolean;
  voiceEnabled: boolean;
}

const DEFAULT_SETTINGS: FeedbackSettings = {
  soundEnabled: true,
  hapticEnabled: true,
  voiceEnabled: true,
};

export function triggerGestureFeedback(
  gestureType: string,
  gestureLabel: string,
  settings: FeedbackSettings = DEFAULT_SETTINGS
) {
  const feedbackType = GESTURE_SOUNDS[gestureType];
  if (!feedbackType || gestureType === "none") return;

  if (settings.soundEnabled) {
    SOUND_PROFILES[feedbackType]();
  }

  if (settings.hapticEnabled) {
    const hapticPattern = feedbackType === "navigate" ? [30, 30, 30] : feedbackType === "positive" ? [20, 40, 60] : 50;
    triggerHaptic(hapticPattern);
  }

  if (settings.voiceEnabled) {
    speakGesture(gestureLabel);
  }
}

export function resumeAudioContext() {
  if (audioCtx?.state === "suspended") {
    audioCtx.resume();
  }
}

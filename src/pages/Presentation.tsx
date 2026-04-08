import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Maximize, Mic, MicOff } from "lucide-react";
import Footer from "@/components/Footer";
import { useVoiceCommandAssistant, type VoiceCommand } from "@/hooks/useVoiceCommandAssistant";

const slides = [
  {
    title: "Welcome to GesturePresenter",
    subtitle: "Control your presentations with hand gestures",
    content: "Use your webcam to navigate slides, pause, and interact — no clicker needed.",
    accent: "hsl(187, 100%, 50%)",
  },
  {
    title: "Supported Gestures",
    subtitle: "Natural hand movements as commands",
    content: "☝️ Point → Next Slide  •  ✌️ Peace → Previous  •  ✋ Palm → Pause  •  ✊ Fist → Hold",
    accent: "hsl(270, 80%, 60%)",
  },
  {
    title: "How It Works",
    subtitle: "MediaPipe Hand Tracking + Computer Vision",
    content: "21 hand landmarks tracked in real-time. Finger extension analysis classifies gestures with high confidence.",
    accent: "hsl(150, 80%, 50%)",
  },
  {
    title: "Try It Now",
    subtitle: "Enable your camera and start gesturing",
    content: "Point your index finger to go to the next slide. Show a peace sign to go back. Open your palm to pause.",
    accent: "hsl(40, 90%, 55%)",
  },
];

const TOTAL_SLIDES = slides.length;

const Presentation = () => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const slideAreaRef = useRef<HTMLDivElement>(null);

  // Laser pointer tracking
  useEffect(() => {
    const el = slideAreaRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      el.style.setProperty("--laser-x", `${e.clientX}px`);
      el.style.setProperty("--laser-y", `${e.clientY}px`);
    };
    el.addEventListener("mousemove", onMove);
    return () => el.removeEventListener("mousemove", onMove);
  }, []);

  const goNext = useCallback(() => setCurrentSlide((s) => Math.min(s + 1, TOTAL_SLIDES - 1)), []);
  const goPrev = useCallback(() => setCurrentSlide((s) => Math.max(s - 1, 0)), []);
  const voiceRespondRef = useRef<(message: string, withVoice?: boolean) => void>(() => {});

  const handleVoiceCommand = useCallback(
    (command: VoiceCommand) => {
      if (command.id === "next_slide") {
        goNext();
        voiceRespondRef.current("Next slide.");
        return;
      }
      if (command.id === "prev_slide") {
        goPrev();
        voiceRespondRef.current("Previous slide.");
        return;
      }
      if (command.id === "go_home") {
        navigate("/");
        voiceRespondRef.current("Returning home.");
        return;
      }
      if (command.id === "help") {
        voiceRespondRef.current("Try Arc next slide, Arc previous slide, or Arc go home.");
      }
    },
    [goNext, goPrev, navigate]
  );

  const voice = useVoiceCommandAssistant({
    wakePhrase: "arc",
    onCommand: handleVoiceCommand,
    onQuery: async (prompt) => {
      try {
        const res = await fetch("/api/arc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        if (!res.ok) {
          voiceRespondRef.current(data?.error ? `Error: ${data.error}` : "Unable to answer right now.");
          return;
        }
        voiceRespondRef.current((data?.text || "No answer.").trim());
      } catch {
        voiceRespondRef.current("Network error. Unable to reach Arc server.");
      }
    },
  });
  voiceRespondRef.current = voice.respond;

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goNext(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      else if (e.key === "Escape") {
        if (document.fullscreenElement) document.exitFullscreen();
        else navigate("/");
      }
      else if (e.key === "Home") setCurrentSlide(0);
      else if (e.key === "End") setCurrentSlide(TOTAL_SLIDES - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, navigate]);

  useEffect(() => {
    const onVoiceControl = (event: Event) => {
      const detail = (event as CustomEvent<{ action?: string }>).detail;
      if (detail?.action === "next") goNext();
      if (detail?.action === "prev") goPrev();
    };
    window.addEventListener("voice-presentation-command", onVoiceControl as EventListener);
    return () => {
      window.removeEventListener("voice-presentation-command", onVoiceControl as EventListener);
    };
  }, [goNext, goPrev]);

  // Track fullscreen state
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  };

  const slide = slides[currentSlide];

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* Top bar — hidden in fullscreen */}
      {!isFullscreen && (
        <div className="flex items-center justify-between px-4 py-2 bg-card/50 backdrop-blur-md border-b border-border z-50">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-xs text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary border border-border transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <span className="font-mono text-xs text-muted-foreground">
            {currentSlide + 1} / {TOTAL_SLIDES}
          </span>
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-xs text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary border border-border transition-all"
          >
            <Maximize className="w-3.5 h-3.5" />
            Fullscreen
          </button>
          <button
            onClick={voice.isListening ? voice.stopListening : voice.startListening}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-xs text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary border border-border transition-all"
          >
            {voice.isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            {voice.isListening ? "Voice On" : "Voice Off"}
          </button>
        </div>
      )}

      {/* Slide area */}
      <div
        ref={slideAreaRef}
        className="flex-1 relative overflow-hidden group laser-cursor"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = (e.clientX - rect.left) / rect.width;
          if (clickX > 0.5) goNext(); else goPrev();
        }}
      >
        {/* Grid background */}
        <div className="absolute inset-0 grid-bg scanline" />

        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.03 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="absolute inset-0 flex flex-col items-center justify-center px-12 text-center z-10"
          >
            {/* Decorative line */}
            <motion.div
              className="w-20 h-0.5 rounded-full mb-10"
              style={{ backgroundColor: slide.accent }}
              initial={{ width: 0 }}
              animate={{ width: 80 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            />

            <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-4 leading-tight">
              {slide.title}
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-10 font-light max-w-2xl">
              {slide.subtitle}
            </p>
            <p className="text-base md:text-lg text-secondary-foreground max-w-xl leading-relaxed">
              {slide.content}
            </p>

            {/* Accent glow */}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-48 rounded-full blur-3xl opacity-10"
              style={{ backgroundColor: slide.accent }}
            />
          </motion.div>
        </AnimatePresence>

        {/* Click zone indicators on hover */}
        <div className="absolute inset-y-0 left-0 w-1/2 group-hover:cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity flex items-center pl-6 z-20 pointer-events-none">
          {currentSlide > 0 && (
            <span className="font-mono text-xs text-muted-foreground/40">← Prev</span>
          )}
        </div>
        <div className="absolute inset-y-0 right-0 w-1/2 group-hover:cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end pr-6 z-20 pointer-events-none">
          {currentSlide < TOTAL_SLIDES - 1 && (
            <span className="font-mono text-xs text-muted-foreground/40">Next →</span>
          )}
        </div>

        {/* Slide indicators */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentSlide
                  ? "w-10 bg-primary glow-primary"
                  : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Fullscreen exit hint */}
      {isFullscreen && (
        <>
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ delay: 2, duration: 1 }}
            className="fixed top-4 right-4 z-50 bg-card/80 backdrop-blur-md border border-border rounded-lg px-3 py-2"
          >
            <span className="font-mono text-[10px] text-muted-foreground">Press ESC to exit</span>
          </motion.div>
          <div className="fixed bottom-4 right-4 z-50 bg-card/80 backdrop-blur-md border border-border rounded-lg px-3 py-2">
            <button
              onClick={voice.isListening ? voice.stopListening : voice.startListening}
              className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-all"
            >
              {voice.isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              {voice.isListening ? "Arc Listening" : "Start Arc"}
            </button>
          </div>
        </>
      )}

      {!isFullscreen && <Footer />}
    </div>
  );
};

export default Presentation;

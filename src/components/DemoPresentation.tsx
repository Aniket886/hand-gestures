import { motion, AnimatePresence } from "framer-motion";

interface DemoPresentationProps {
  currentSlide: number;
  totalSlides: number;
}

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

const DemoPresentation = ({ currentSlide, totalSlides }: DemoPresentationProps) => {
  const slide = slides[currentSlide] || slides[0];

  return (
    <div className="relative w-full h-full bg-card rounded-xl border border-border overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 grid-bg scanline" />

      {/* Slide content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="relative z-10 flex flex-col items-center justify-center h-full px-8 py-12 text-center"
        >
          {/* Slide number */}
          <span className="font-mono text-xs text-muted-foreground tracking-widest uppercase mb-6">
            Slide {currentSlide + 1} / {totalSlides}
          </span>

          {/* Decorative line */}
          <motion.div
            className="w-16 h-0.5 rounded-full mb-8"
            style={{ backgroundColor: slide.accent }}
            initial={{ width: 0 }}
            animate={{ width: 64 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          />

          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            {slide.title}
          </h2>
          <p className="text-lg text-muted-foreground mb-8 font-light">
            {slide.subtitle}
          </p>
          <p className="text-sm text-secondary-foreground max-w-md leading-relaxed">
            {slide.content}
          </p>

          {/* Accent glow */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full blur-3xl opacity-10"
            style={{ backgroundColor: slide.accent }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Slide indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
        {Array.from({ length: totalSlides }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === currentSlide
                ? "w-8 bg-primary glow-primary"
                : "w-1.5 bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default DemoPresentation;

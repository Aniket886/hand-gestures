import { describe, expect, it } from "vitest";
import {
  findWakeWord,
  interpretTranscript,
  isQuestionLike,
  normalizeTranscript,
  parseVoiceCommand,
} from "@/hooks/useVoiceCommandAssistant";

describe("Voice Assistant helpers", () => {
  it("normalizes transcript", () => {
    expect(normalizeTranscript(" Arc,   Start Tracking!! ")).toBe("arc start tracking");
  });

  it("does not match wake word inside other words", () => {
    const wake = findWakeWord("architecture is cool", ["arc"]);
    expect(wake.hasWake).toBe(false);
  });

  it("matches wake word with aliases", () => {
    const wake = findWakeWord("ark start tracking", ["arc", "ark", "are"]);
    expect(wake.hasWake).toBe(true);
    expect(wake.afterWake).toBe("start tracking");
  });

  it("parses command synonyms", () => {
    expect(parseVoiceCommand("start")?.id).toBe("start_tracking");
    expect(parseVoiceCommand("begin")?.id).toBe("start_tracking");
    expect(parseVoiceCommand("stop")?.id).toBe("stop_tracking");
    expect(parseVoiceCommand("next")?.id).toBe("next_slide");
    expect(parseVoiceCommand("back")?.id).toBe("prev_slide");
    expect(parseVoiceCommand("calibrate")?.id).toBe("capture_calibration");
  });

  it("wake-only arms assistant", () => {
    const now = 1000;
    const res = interpretTranscript({
      transcript: "Arc",
      nowMs: now,
      armedUntilMs: 0,
      wakeWords: ["arc", "ark", "are"],
      wakeWindowMs: 6000,
    });
    expect(res.isWakeOnly).toBe(true);
    expect(res.command).toBe(null);
    expect(res.nextArmedUntilMs).toBe(now + 6000);
  });

  it("wake + command executes immediately and disarms", () => {
    const res = interpretTranscript({
      transcript: "Arc stop tracking",
      nowMs: 1000,
      armedUntilMs: 0,
      wakeWords: ["arc", "ark", "are"],
      wakeWindowMs: 6000,
    });
    expect(res.command?.id).toBe("stop_tracking");
    expect(res.nextArmedUntilMs).toBe(0);
  });

  it("armed + command without wake executes", () => {
    const res = interpretTranscript({
      transcript: "stop tracking",
      nowMs: 2000,
      armedUntilMs: 2500,
      wakeWords: ["arc", "ark", "are"],
      wakeWindowMs: 6000,
    });
    expect(res.command?.id).toBe("stop_tracking");
    expect(res.nextArmedUntilMs).toBe(0);
  });

  it("question cue gating", () => {
    expect(isQuestionLike("what is todays date")).toBe(true);
    expect(isQuestionLike("tell me about gestures")).toBe(true);
    expect(isQuestionLike("which planet is largest")).toBe(true);
    expect(isQuestionLike("can you explain jupiter")).toBe(true);
    expect(isQuestionLike("do you know the answer")).toBe(true);
    expect(isQuestionLike("what is scientific name of dog")).toBe(true);
    expect(isQuestionLike("nickname of dog")).toBe(true);
    expect(isQuestionLike("full form of ai")).toBe(true);
    expect(isQuestionLike("meaning of gravity")).toBe(true);
    expect(isQuestionLike("start tracking")).toBe(false);
    expect(isQuestionLike("random words")).toBe(false);
  });
});

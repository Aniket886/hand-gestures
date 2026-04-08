import { useState, useEffect, useCallback } from "react";
import type { GestureType } from "@/lib/gestures";
import { GESTURE_MAP } from "@/lib/gestures";

export type PresentationAction =
  | "next_slide"
  | "prev_slide"
  | "pause"
  | "first_slide"
  | "last_slide"
  | "toggle_pointer"
  | "highlight"
  | "blank_screen"
  | "none";

export const ACTION_OPTIONS: { value: PresentationAction; label: string }[] = [
  { value: "next_slide", label: "Next Slide →" },
  { value: "prev_slide", label: "← Previous Slide" },
  { value: "pause", label: "Pause / Stop" },
  { value: "first_slide", label: "First Slide" },
  { value: "last_slide", label: "Last Slide" },
  { value: "toggle_pointer", label: "Toggle Pointer" },
  { value: "highlight", label: "Highlight" },
  { value: "blank_screen", label: "Blank Screen" },
  { value: "none", label: "No Action" },
];

export interface GestureMapping {
  gesture: GestureType;
  emoji: string;
  label: string;
  action: PresentationAction;
  isCustom?: boolean;
}

const DEFAULT_MAPPINGS: GestureMapping[] = [
  { gesture: "pointing", emoji: "☝️", label: "Point Up", action: "next_slide" },
  { gesture: "peace", emoji: "✌️", label: "Peace / Victory", action: "prev_slide" },
  { gesture: "open_palm", emoji: "✋", label: "Open Palm", action: "pause" },
  { gesture: "fist", emoji: "✊", label: "Fist", action: "none" },
  { gesture: "thumbs_up", emoji: "👍", label: "Thumbs Up", action: "none" },
  { gesture: "thumbs_down", emoji: "👎", label: "Thumbs Down", action: "none" },
  { gesture: "rock", emoji: "🤘", label: "Rock On", action: "highlight" },
  { gesture: "love_you", emoji: "🤟", label: "Love You", action: "none" },
  { gesture: "call_me", emoji: "🤙", label: "Call Me / Shaka", action: "none" },
  { gesture: "gun", emoji: "👈", label: "Finger Gun", action: "toggle_pointer" },
  { gesture: "ok_sign", emoji: "👌", label: "OK Sign", action: "none" },
  { gesture: "pinch", emoji: "🤏", label: "Pinch", action: "none" },
  { gesture: "three", emoji: "🖖", label: "Three", action: "none" },
  { gesture: "four", emoji: "🖐️", label: "Four", action: "none" },
  { gesture: "vulcan", emoji: "🖖", label: "Vulcan Salute", action: "none" },
  { gesture: "middle_finger", emoji: "🖕", label: "Middle Finger", action: "none" },
  { gesture: "pinky_up", emoji: "🤙", label: "Pinky Up", action: "none" },
  { gesture: "swipe_left", emoji: "👈", label: "Swipe Left", action: "next_slide" },
  { gesture: "swipe_right", emoji: "👉", label: "Swipe Right", action: "prev_slide" },
];

const STORAGE_KEY = "gesture-presenter-mappings";

function loadMappings(): GestureMapping[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as GestureMapping[];
      // Merge with defaults to pick up any new built-in gestures
      const savedMap = new Map(parsed.map((m) => [m.gesture, m]));
      const merged = DEFAULT_MAPPINGS.map((d) => savedMap.get(d.gesture) || d);
      // Add any custom entries not in defaults
      const customEntries = parsed.filter((m) => m.isCustom && !DEFAULT_MAPPINGS.find((d) => d.gesture === m.gesture));
      return [...merged, ...customEntries];
    }
  } catch {
    // ignore invalid persisted mappings
  }
  return [...DEFAULT_MAPPINGS];
}

function saveMappings(mappings: GestureMapping[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
}

export function useGestureMappings() {
  const [mappings, setMappings] = useState<GestureMapping[]>(loadMappings);

  useEffect(() => {
    saveMappings(mappings);
  }, [mappings]);

  const updateMapping = useCallback((gesture: GestureType, action: PresentationAction) => {
    setMappings((prev) =>
      prev.map((m) => (m.gesture === gesture ? { ...m, action } : m))
    );
  }, []);

  const updateEmoji = useCallback((gesture: GestureType, emoji: string) => {
    setMappings((prev) =>
      prev.map((m) => (m.gesture === gesture ? { ...m, emoji } : m))
    );
  }, []);

  const updateLabel = useCallback((gesture: GestureType, label: string) => {
    setMappings((prev) =>
      prev.map((m) => (m.gesture === gesture ? { ...m, label } : m))
    );
  }, []);

  const addCustomGesture = useCallback((emoji: string, label: string, action: PresentationAction, baseGesture: GestureType) => {
    const id = `custom_${Date.now()}` as GestureType;
    setMappings((prev) => [
      ...prev,
      { gesture: baseGesture, emoji, label, action, isCustom: true },
    ]);
    return id;
  }, []);

  const removeCustomGesture = useCallback((index: number) => {
    setMappings((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const resetToDefaults = useCallback(() => {
    setMappings([...DEFAULT_MAPPINGS]);
  }, []);

  const getActionForGesture = useCallback(
    (gesture: GestureType): PresentationAction => {
      const mapping = mappings.find((m) => m.gesture === gesture);
      return mapping?.action || "none";
    },
    [mappings]
  );

  return {
    mappings,
    updateMapping,
    updateEmoji,
    updateLabel,
    addCustomGesture,
    removeCustomGesture,
    resetToDefaults,
    getActionForGesture,
  };
}

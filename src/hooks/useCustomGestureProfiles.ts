import { useCallback, useEffect, useState } from "react";
import type { CustomGestureProfile } from "@/lib/customGestures";

const STORAGE_KEY = "gesture-presenter-custom-gesture-profiles";

function loadProfiles(): CustomGestureProfile[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved) as CustomGestureProfile[];
    return parsed.filter((profile) => profile?.id && profile?.label && Array.isArray(profile.samples));
  } catch {
    return [];
  }
}

export function useCustomGestureProfiles() {
  const [profiles, setProfiles] = useState<CustomGestureProfile[]>(loadProfiles);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  }, [profiles]);

  const addProfile = useCallback((label: string, emoji: string, samples: number[][]) => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel || samples.length < 2) return null;

    const id = `custom_${Date.now()}` as const;
    const profile: CustomGestureProfile = {
      id,
      label: trimmedLabel,
      emoji: emoji || "✋",
      samples,
      createdAt: new Date().toISOString(),
    };
    setProfiles((prev) => [...prev, profile]);
    return profile;
  }, []);

  const removeProfile = useCallback((id: string) => {
    setProfiles((prev) => prev.filter((profile) => profile.id !== id));
  }, []);

  return { profiles, addProfile, removeProfile };
}

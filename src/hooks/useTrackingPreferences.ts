import { useCallback, useEffect, useState } from "react";

export interface TrackingPreferences {
  handReferenceCm: number;
  cameraDistanceFactor: number;
  gestureConfidenceThreshold: number;
  actionDebounceMs: number;
  handednessConfidenceThreshold: number;
  handednessDebounceMs: number;
}

const STORAGE_KEY = "gesture-presenter-tracking-preferences";

export const DEFAULT_TRACKING_PREFERENCES: TrackingPreferences = {
  handReferenceCm: 8.5,
  cameraDistanceFactor: 1,
  gestureConfidenceThreshold: 0.6,
  actionDebounceMs: 1200,
  handednessConfidenceThreshold: 0.75,
  handednessDebounceMs: 220,
};

function sanitizePreferences(input: Partial<TrackingPreferences> | null | undefined): TrackingPreferences {
  const next = { ...DEFAULT_TRACKING_PREFERENCES, ...(input ?? {}) };
  return {
    handReferenceCm: Math.min(12, Math.max(6, Number(next.handReferenceCm))),
    cameraDistanceFactor: Math.min(1.5, Math.max(0.6, Number(next.cameraDistanceFactor))),
    gestureConfidenceThreshold: Math.min(0.95, Math.max(0.2, Number(next.gestureConfidenceThreshold))),
    actionDebounceMs: Math.min(2500, Math.max(150, Number(next.actionDebounceMs))),
    handednessConfidenceThreshold: Math.min(0.98, Math.max(0.4, Number(next.handednessConfidenceThreshold))),
    handednessDebounceMs: Math.min(1000, Math.max(0, Number(next.handednessDebounceMs))),
  };
}

function loadPreferences(): TrackingPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TRACKING_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<TrackingPreferences>;
    return sanitizePreferences(parsed);
  } catch {
    return DEFAULT_TRACKING_PREFERENCES;
  }
}

export function useTrackingPreferences() {
  const [settings, setSettings] = useState<TrackingPreferences>(loadPreferences);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSetting = useCallback(
    <K extends keyof TrackingPreferences>(key: K, value: TrackingPreferences[K]) => {
      setSettings((prev) => sanitizePreferences({ ...prev, [key]: value }));
    },
    []
  );

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_TRACKING_PREFERENCES);
  }, []);

  return { settings, updateSetting, resetSettings };
}

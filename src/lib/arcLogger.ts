export interface ArcLogEntry {
  state: string;
  transcript?: string;
  action: string;
  timestamp: string;
  detail?: string;
}

const MAX_LOGS = 200;
const arcLogs: ArcLogEntry[] = [];

declare global {
  interface Window {
    __arcLogs?: ArcLogEntry[];
  }
}

export function logArcEvent(entry: Omit<ArcLogEntry, "timestamp">) {
  const withTimestamp: ArcLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  arcLogs.push(withTimestamp);
  if (arcLogs.length > MAX_LOGS) {
    arcLogs.shift();
  }

  if (typeof window !== "undefined") {
    window.__arcLogs = [...arcLogs];
  }

  if (typeof console !== "undefined") {
    console.debug("[ARC]", withTimestamp);
  }
}

export function getArcLogs() {
  return [...arcLogs];
}

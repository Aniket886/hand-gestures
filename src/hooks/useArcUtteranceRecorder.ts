import { useCallback, useRef, useState } from "react";
import { logArcEvent } from "@/lib/arcLogger";

interface RecordOptions {
  maxDurationMs?: number;
  silenceMs?: number;
  preRollMs?: number;
}

type StopReason = "silence" | "timeout" | "error" | "empty";

export interface ArcUtteranceResult {
  blob: Blob | null;
  mimeType: string;
  heardSpeech: boolean;
  durationMs: number;
  stopReason: StopReason;
}

function getPreferredMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || "";
}

function getRms(analyser: AnalyserNode, data: Uint8Array) {
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (let index = 0; index < data.length; index++) {
    const normalized = (data[index] - 128) / 128;
    sum += normalized * normalized;
  }
  return Math.sqrt(sum / data.length);
}

export function useArcUtteranceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const monitoringRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (monitoringRef.current) {
      window.clearInterval(monitoringRef.current);
      monitoringRef.current = null;
    }
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (maxTimerRef.current) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }

    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  const recordUtterance = useCallback(
    async ({ maxDurationMs = 6500, silenceMs = 1800, preRollMs = 800 }: RecordOptions = {}) => {
      if (isRecording) return null;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getPreferredMimeType();
      logArcEvent({ state: "recording", action: "recording_waiting_for_speech", detail: mimeType || "default-mime" });
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const chunks: BlobPart[] = [];
      let heardSpeech = false;
      let stopRequested = false;
      let stopReason: StopReason = "timeout";
      const startedAt = Date.now();
      let preRollComplete = false;

      const stopRecorder = () => {
        if (stopRequested) return;
        stopRequested = true;
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      };

      monitoringRef.current = window.setInterval(() => {
        if (!preRollComplete) return;
        const rms = getRms(analyser, data);
        if (rms > 0.022) {
          heardSpeech = true;
          logArcEvent({ state: "recording", action: "recording_speech_detected", detail: rms.toFixed(4) });
          if (silenceTimerRef.current) {
            window.clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          return;
        }

        if (heardSpeech && !silenceTimerRef.current) {
          silenceTimerRef.current = window.setTimeout(() => {
            stopReason = "silence";
            logArcEvent({ state: "recording", action: "recording_stopped_silence" });
            stopRecorder();
          }, silenceMs);
        }
      }, 120);

      window.setTimeout(() => {
        preRollComplete = true;
      }, preRollMs);

      maxTimerRef.current = window.setTimeout(() => {
        stopReason = heardSpeech ? "timeout" : "empty";
        logArcEvent({ state: "recording", action: "recording_timeout" });
        stopRecorder();
      }, maxDurationMs);

      return await new Promise<ArcUtteranceResult | null>((resolve) => {
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        recorder.onerror = () => {
          stopReason = "error";
          cleanup();
          resolve(null);
        };

        recorder.onstop = () => {
          const blob = chunks.length ? new Blob(chunks, { type: recorder.mimeType || "audio/webm" }) : null;
          const durationMs = Date.now() - startedAt;
          if (blob?.size) {
            logArcEvent({
              state: "recording",
              action: "recording_blob_ready",
              detail: `${blob.size}b ${recorder.mimeType || "audio/webm"} ${durationMs}ms`,
            });
          } else {
            logArcEvent({ state: "recording", action: "recording_empty", detail: `${durationMs}ms` });
          }
          cleanup();
          resolve({
            blob,
            mimeType: recorder.mimeType || "audio/webm",
            heardSpeech,
            durationMs,
            stopReason: heardSpeech && blob && blob.size > 0 ? stopReason : "empty",
          });
        };

        recorder.start(150);
      });
    },
    [cleanup, isRecording]
  );

  return {
    isRecording,
    recordUtterance,
    cancelRecording: cleanup,
  };
}

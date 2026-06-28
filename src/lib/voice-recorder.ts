import { useCallback, useRef, useState } from "react";

export type MicErrorKind =
  | "denied"
  | "no-device"
  | "insecure-context"
  | "unsupported"
  | "in-use"
  | "unknown";

export class MicError extends Error {
  kind: MicErrorKind;
  constructor(kind: MicErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

/** Friendly, copyable message for a mic error. */
export function micErrorMessage(e: unknown): { title: string; hint: string; kind: MicErrorKind } {
  const kind: MicErrorKind = e instanceof MicError ? e.kind : "unknown";
  switch (kind) {
    case "denied":
      return {
        kind,
        title: "Microphone blocked",
        hint: "Click the lock/permissions icon in your browser's address bar and allow microphone access, then try again.",
      };
    case "no-device":
      return { kind, title: "No microphone found", hint: "Connect a microphone or check your input device." };
    case "insecure-context":
      return {
        kind,
        title: "Microphone needs HTTPS",
        hint: "Voice input requires a secure (https) connection.",
      };
    case "unsupported":
      return {
        kind,
        title: "Voice not supported here",
        hint: "Your browser doesn't expose microphone APIs. Try Chrome, Edge, Firefox, or Safari.",
      };
    case "in-use":
      return {
        kind,
        title: "Microphone in use",
        hint: "Another tab or app is using your microphone. Close it and try again.",
      };
    default:
      return { kind, title: "Couldn't start microphone", hint: "Try again in a moment." };
  }
}

/** Returns 'granted' | 'denied' | 'prompt' | 'unknown' without prompting (when supported). */
export async function getMicPermission(): Promise<"granted" | "denied" | "prompt" | "unknown"> {
  if (typeof navigator === "undefined") return "unknown";
  // @ts-expect-error - permissions.query 'microphone' isn't in lib.dom for all targets
  if (!navigator.permissions?.query) return "unknown";
  try {
    // @ts-expect-error - 'microphone' descriptor
    const res = await navigator.permissions.query({ name: "microphone" });
    return res.state as "granted" | "denied" | "prompt";
  } catch {
    return "unknown";
  }
}

/** Captures mic audio as a complete WAV blob (16kHz mono) with browser-safe error handling. */
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef<number>(48000);

  const start = useCallback(async () => {
    if (typeof window === "undefined") throw new MicError("unsupported", "No window");
    if (!window.isSecureContext && location.hostname !== "localhost") {
      throw new MicError("insecure-context", "HTTPS required");
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new MicError("unsupported", "getUserMedia missing");
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      const name = (err as DOMException)?.name ?? "";
      if (name === "NotAllowedError" || name === "SecurityError") throw new MicError("denied", String(err));
      if (name === "NotFoundError" || name === "OverconstrainedError") throw new MicError("no-device", String(err));
      if (name === "NotReadableError" || name === "AbortError") throw new MicError("in-use", String(err));
      throw new MicError("unknown", String(err));
    }

    const AudioCtx: typeof AudioContext =
      (window.AudioContext as typeof AudioContext) ??
      // @ts-expect-error vendor prefix for older Safari
      window.webkitAudioContext;
    if (!AudioCtx) {
      stream.getTracks().forEach((t) => t.stop());
      throw new MicError("unsupported", "AudioContext missing");
    }
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* ignore — will still capture once user gesture lets it run */
      }
    }
    const source = ctx.createMediaStreamSource(stream);
    const node = ctx.createScriptProcessor(4096, 1, 1);
    chunksRef.current = [];
    sampleRateRef.current = ctx.sampleRate;
    node.onaudioprocess = (e) => {
      chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };
    source.connect(node);
    node.connect(ctx.destination);
    ctxRef.current = ctx;
    streamRef.current = stream;
    nodeRef.current = node;
    sourceRef.current = source;
    setRecording(true);
  }, []);

  const stop = useCallback(async (): Promise<Blob | null> => {
    setRecording(false);
    const stream = streamRef.current;
    const ctx = ctxRef.current;
    const node = nodeRef.current;
    const source = sourceRef.current;
    if (!stream || !ctx || !node || !source) return null;
    stream.getTracks().forEach((t) => t.stop());
    node.disconnect();
    source.disconnect();
    const blob = encodeWav(chunksRef.current, sampleRateRef.current, 16000);
    await ctx.close();
    ctxRef.current = null;
    streamRef.current = null;
    nodeRef.current = null;
    sourceRef.current = null;
    return blob;
  }, []);

  const cancel = useCallback(() => {
    setRecording(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    nodeRef.current?.disconnect();
    sourceRef.current?.disconnect();
    ctxRef.current?.close().catch(() => undefined);
    ctxRef.current = null;
    streamRef.current = null;
    nodeRef.current = null;
    sourceRef.current = null;
    chunksRef.current = [];
  }, []);

  return { recording, start, stop, cancel };
}

function encodeWav(chunks: Float32Array[], inputRate: number, targetRate: number): Blob {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const merged = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    merged.set(c, o);
    o += c.length;
  }
  const ratio = inputRate / targetRate;
  const newLen = Math.floor(merged.length / ratio);
  const down = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) down[i] = merged[Math.floor(i * ratio)] || 0;

  const buffer = new ArrayBuffer(44 + down.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + down.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, down.length * 2, true);
  let off = 44;
  for (let i = 0; i < down.length; i++) {
    const s = Math.max(-1, Math.min(1, down[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

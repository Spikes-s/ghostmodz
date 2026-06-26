import { useCallback, useRef, useState } from "react";

/** Captures mic audio as a complete WAV blob (16kHz mono). */
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef<number>(48000);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new AudioContext();
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

  return { recording, start, stop };
}

function encodeWav(chunks: Float32Array[], inputRate: number, targetRate: number): Blob {
  // concat
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const merged = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    merged.set(c, o);
    o += c.length;
  }
  // downsample
  const ratio = inputRate / targetRate;
  const newLen = Math.floor(merged.length / ratio);
  const down = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) down[i] = merged[Math.floor(i * ratio)] || 0;

  // PCM 16-bit
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

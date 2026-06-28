import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquarePlus, Trash2, Pencil, Search, Send, Mic, MicOff,
  Volume2, Paperclip, Loader2, Hammer, Sparkles, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Markdown } from "@/components/ghost/Markdown";
import { SpikesIntro } from "@/components/ghost/SpikesIntro";
import { useVoiceRecorder, getMicPermission, micErrorMessage } from "@/lib/voice-recorder";
import {
  createConversation, deleteConversation, getMessages, listConversations,
  renameConversation, saveMessages,
} from "@/lib/spikes.functions";

export const Route = createFileRoute("/_authenticated/spikes/$conversationId")({
  head: () => ({ meta: [{ title: "Spikes Bot — Ghost Mods Tech" }] }),
  component: SpikesChat,
});

function SpikesChat() {
  const { conversationId } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const [showIntro, setShowIntro] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem("spikes-intro-shown");
  });

  useEffect(() => {
    if (!showIntro && typeof window !== "undefined") {
      sessionStorage.setItem("spikes-intro-shown", "1");
    }
  }, [showIntro]);

  const listFn = useServerFn(listConversations);
  const getMsgsFn = useServerFn(getMessages);
  const createFn = useServerFn(createConversation);
  const renameFn = useServerFn(renameConversation);
  const deleteFn = useServerFn(deleteConversation);
  const saveFn = useServerFn(saveMessages);

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => listFn(),
  });

  const { data: initialMessages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => getMsgsFn({ data: { conversationId } }),
  });

  const initialUiMessages = useMemo<UIMessage[]>(
    () =>
      (initialMessages as Array<{ id: string; role: string; parts: unknown }>).map((m) => ({
        id: m.id,
        role: m.role as UIMessage["role"],
        parts: (m.parts as UIMessage["parts"]) ?? [],
      })),
    [initialMessages],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { mode: "talk" },
      }),
    [],
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    id: conversationId,
    transport,
    onError: (e) => toast.error(e.message || "Spikes hit an error"),
  });

  // Hydrate on switch
  useEffect(() => {
    if (!loadingMessages) setMessages(initialUiMessages);
  }, [conversationId, loadingMessages, initialUiMessages, setMessages]);

  // Autosave when stream completes
  const lastSavedRef = useRef<string>("");
  useEffect(() => {
    if (status !== "ready" || messages.length === 0) return;
    const sig = JSON.stringify(messages.map((m) => [m.role, m.parts]));
    if (sig === lastSavedRef.current) return;
    lastSavedRef.current = sig;
    saveFn({
      data: {
        conversationId,
        messages: messages.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          parts: m.parts as unknown[],
        })),
      },
    }).catch((e) => console.error("autosave failed", e));
  }, [status, messages, conversationId, saveFn]);

  // ---------- Conversation actions ----------
  async function newChat() {
    const created = await createFn({ data: { title: "New Chat", mode: "talk" } });
    qc.invalidateQueries({ queryKey: ["conversations"] });
    navigate({ to: "/spikes/$conversationId", params: { conversationId: created.id } });
  }
  async function rename(id: string, current: string) {
    const next = window.prompt("Rename chat", current);
    if (!next || next === current) return;
    await renameFn({ data: { id, title: next } });
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this chat?")) return;
    await deleteFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["conversations"] });
    if (id === conversationId) {
      const remaining = (conversations as Array<{ id: string }>).filter((c) => c.id !== id);
      if (remaining.length > 0) {
        navigate({ to: "/spikes/$conversationId", params: { conversationId: remaining[0].id } });
      } else {
        router.invalidate();
        navigate({ to: "/spikes" });
      }
    }
  }

  // ---------- Composer ----------
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { recording, start: startRec, stop: stopRec } = useVoiceRecorder();
  const [transcribing, setTranscribing] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text && files.length === 0) return;
    if (status === "streaming" || status === "submitted") return;

    const parts: Array<Record<string, unknown>> = [];
    if (text) parts.push({ type: "text", text });
    for (const f of files) {
      const url = await fileToDataUrl(f);
      parts.push({ type: "file", url, mediaType: f.type || "application/octet-stream", filename: f.name });
    }
    setInput("");
    setFiles([]);
    await sendMessage({ role: "user", parts: parts as UIMessage["parts"] });

    // Auto-title first message
    const conv = (conversations as Array<{ id: string; title: string }>).find((c) => c.id === conversationId);
    if (conv && conv.title === "New Chat" && text) {
      const title = text.slice(0, 48);
      renameFn({ data: { id: conversationId, title } }).then(() =>
        qc.invalidateQueries({ queryKey: ["conversations"] }),
      );
    }
  }

  async function toggleRecording() {
    if (recording) {
      const blob = await stopRec();
      if (!blob || blob.size < 2048) {
        toast.error("Recording too short", { description: "Hold the mic and speak for at least a second." });
        return;
      }
      setTranscribing(true);
      try {
        const fd = new FormData();
        fd.append("file", blob, "recording.wav");
        const res = await fetch("/api/transcribe", { method: "POST", body: fd });
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as { text?: string };
        if (json.text) setInput((p) => (p ? p + " " + json.text : json.text!));
      } catch (e) {
        toast.error("Transcription failed");
        console.error(e);
      } finally {
        setTranscribing(false);
      }
      return;
    }

    // Pre-check permission so we don't show the prompt twice or mislabel denial
    const perm = await getMicPermission();
    if (perm === "denied") {
      const m = micErrorMessage(new (await import("@/lib/voice-recorder")).MicError("denied", "denied"));
      toast.error(m.title, { description: m.hint });
      return;
    }
    try {
      await startRec();
    } catch (err) {
      const m = micErrorMessage(err);
      toast.error(m.title, { description: m.hint });
    }
  }

  async function speak(text: string) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      new Audio(URL.createObjectURL(blob)).play();
    } catch {
      toast.error("Voice synthesis failed");
    }
  }

  // ---------- Sidebar search ----------
  const [search, setSearch] = useState("");
  const filtered = (conversations as Array<{ id: string; title: string }>).filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()),
  );

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <>
      {showIntro && <SpikesIntro onDone={() => setShowIntro(false)} />}
      <div className="grid h-[calc(100vh-65px)] grid-cols-1 lg:grid-cols-[280px_1fr]">
        {/* SIDEBAR */}
        <aside className="hidden lg:flex flex-col border-r border-border/40 glass">
          <div className="p-3 space-y-2">
            <Button onClick={newChat} className="w-full gap-2 glow-purple">
              <MessageSquarePlus className="h-4 w-4" /> New Chat
            </Button>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats"
                className="pl-7 h-8 text-xs"
              />
            </div>
            <Link to="/build" className="block">
              <Button variant="outline" size="sm" className="w-full gap-2 glass">
                <Hammer className="h-3.5 w-3.5" /> Build Mode
              </Button>
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
            {filtered.map((c) => {
              const active = c.id === conversationId;
              return (
                <div
                  key={c.id}
                  className={`group flex items-center gap-1 rounded-md p-2 text-xs transition-colors ${
                    active ? "bg-primary/20 border border-primary/40" : "hover:bg-muted/50"
                  }`}
                >
                  <Link
                    to="/spikes/$conversationId"
                    params={{ conversationId: c.id }}
                    className="flex-1 truncate text-foreground"
                  >
                    {c.title}
                  </Link>
                  <button
                    onClick={() => rename(c.id, c.title)}
                    className="opacity-0 group-hover:opacity-100 transition p-1 hover:text-secondary"
                    aria-label="Rename"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => remove(c.id)}
                    className="opacity-0 group-hover:opacity-100 transition p-1 hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">No chats yet</p>
            )}
          </div>
        </aside>

        {/* MAIN CHAT */}
        <main className="flex flex-col h-full overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto max-w-3xl space-y-5">
              {messages.length === 0 && !isLoading && (
                <div className="text-center py-20">
                  <Sparkles className="mx-auto h-12 w-12 text-primary mb-4 animate-pulse-glow" />
                  <h2 className="text-2xl font-display font-bold neon-text">Talk to Spikes</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Voice, files, images, links, code — all in one neural core.
                  </p>
                </div>
              )}
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} onSpeak={speak} />
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Spikes is thinking…
                </div>
              )}
            </div>
          </div>

          {/* COMPOSER */}
          <div className="border-t border-border/40 glass p-3">
            <div className="mx-auto max-w-3xl space-y-2">
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs">
                      <span className="max-w-[160px] truncate">{f.name}</span>
                      <button
                        onClick={() => setFiles((fs) => fs.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept="image/*,video/*,application/pdf,text/*"
                  onChange={(e) => {
                    const list = Array.from(e.target.files ?? []);
                    setFiles((fs) => [...fs, ...list]);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                />
                <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} title="Attach">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  variant={recording ? "destructive" : "ghost"}
                  size="icon"
                  onClick={toggleRecording}
                  disabled={transcribing}
                  title={recording ? "Stop recording" : "Voice input"}
                >
                  {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Message Spikes…"
                  rows={1}
                  className="min-h-[40px] max-h-40 resize-none flex-1 bg-input/60"
                />
                <Button onClick={send} disabled={isLoading} className="glow-purple" size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[10px] text-center text-muted-foreground">
                Spikes can read text, code, images, and audio. Press Enter to send · Shift+Enter for newline
              </p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

function MessageBubble({
  message,
  onSpeak,
}: {
  message: UIMessage;
  onSpeak: (text: string) => void;
}) {
  const isUser = message.role === "user";
  const text = message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
  const files = message.parts.filter(
    (p): p is { type: "file"; url: string; mediaType: string; filename?: string } =>
      p.type === "file",
  );

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "glass-card"
        }`}
      >
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {files.map((f, i) =>
              f.mediaType?.startsWith("image/") ? (
                <img key={i} src={f.url} alt={f.filename ?? "image"} className="max-h-40 rounded-md border border-border" />
              ) : (
                <a key={i} href={f.url} target="_blank" rel="noreferrer" className="text-xs underline">
                  {f.filename ?? "file"}
                </a>
              ),
            )}
          </div>
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm">{text}</p>
        ) : (
          <>
            <Markdown>{text}</Markdown>
            {text && (
              <button
                onClick={() => onSpeak(text)}
                className="mt-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-secondary"
              >
                <Volume2 className="h-3 w-3" /> Speak
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

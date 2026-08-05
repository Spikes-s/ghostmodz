import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Send, X, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Markdown } from "@/components/ghost/Markdown";
import { askTutor } from "@/lib/academy-tutor.functions";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Explain this lesson in simpler terms",
  "Give me a real-world example",
  "Why did my exercise answer fail?",
  "Quiz me on this topic",
];

export function AiTutor({ lessonId, lessonTitle }: { lessonId: string; lessonTitle: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const ask = useServerFn(askTutor);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (open && !busy) inputRef.current?.focus();
  }, [open, busy]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const r = (await ask({ data: { lesson_id: lessonId, messages: next } })) as { reply: string };
      setMessages((m) => [...m, { role: "assistant", content: r.reply }]);
    } catch (e: any) {
      toast.error(e?.message || "The tutor is unavailable right now");
      setMessages((m) => m.slice(0, -1));
      setInput(question);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-6 z-40 gap-2 rounded-full glow-purple shadow-lg"
      >
        <Bot className="h-4 w-4" /> Ask Spikes
      </Button>
    );
  }

  return (
    <div className="fixed bottom-6 right-4 z-50 flex h-[70vh] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-primary/40 glass-card shadow-2xl">
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Spikes Tutor</p>
            <p className="truncate text-[11px] text-muted-foreground">{lessonTitle}</p>
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="Close tutor">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Stuck on something? Ask about anything in this lesson.
            </p>
            <div className="space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="flex w-full items-center gap-2 rounded-lg border border-border/40 px-3 py-2 text-left text-xs transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <MessageCircleQuestion className="h-3.5 w-3.5 text-secondary" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="text-sm">
              <Markdown>{m.content}</Markdown>
            </div>
          ),
        )}

        {busy && <p className="animate-pulse text-xs text-muted-foreground">Spikes is thinking…</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t border-border/40 p-3"
      >
        <Textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask about this lesson…"
          className="max-h-32 min-h-[2.5rem] resize-none"
        />
        <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send question">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send, Bot, User, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  getOrCreateMyThread, listThreadMessages, sendMessage, markThreadRead,
} from "@/lib/workflow.functions";
import { generateAiReply } from "@/lib/ai-support.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({ meta: [{ title: "Live Support — Ghost Mods Tech" }] }),
  component: SupportPage,
});

function SupportPage() {
  const qc = useQueryClient();
  const createFn = useServerFn(getOrCreateMyThread);
  const listFn = useServerFn(listThreadMessages);
  const sendFn = useServerFn(sendMessage);
  const readFn = useServerFn(markThreadRead);
  const aiFn = useServerFn(generateAiReply);

  const { data: thread } = useQuery({ queryKey: ["my-thread"], queryFn: () => createFn() });
  const threadId = (thread as any)?.id as string | undefined;
  const aiActive = !!(thread as any)?.ai_enabled && !(thread as any)?.admin_active;

  const { data: messages = [] } = useQuery({
    queryKey: ["thread-msgs", threadId],
    queryFn: () => listFn({ data: { threadId: threadId! } }),
    enabled: !!threadId,
  });

  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, aiThinking]);

  useEffect(() => {
    if (!threadId) return;
    readFn({ data: { threadId } }).catch(() => undefined);
    const channel = supabase
      .channel(`support:${threadId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages", filter: `thread_id=eq.${threadId}` }, () => {
        qc.invalidateQueries({ queryKey: ["thread-msgs", threadId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "support_threads", filter: `id=eq.${threadId}` }, () => {
        qc.invalidateQueries({ queryKey: ["my-thread"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId, qc, readFn]);

  async function submit() {
    const txt = body.trim();
    if (!txt || !threadId) return;
    setSending(true);
    try {
      await sendFn({ data: { threadId, body: txt } });
      setBody("");
      qc.invalidateQueries({ queryKey: ["thread-msgs", threadId] });
      if (aiActive) {
        setAiThinking(true);
        try {
          await aiFn({ data: { threadId } });
          qc.invalidateQueries({ queryKey: ["thread-msgs", threadId] });
        } catch (e: any) {
          // silent fallback — admin will pick up
          console.warn("AI reply failed", e?.message);
        } finally {
          setAiThinking(false);
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  }

  function bubbleStyle(role: string) {
    if (role === "user") return "bg-primary/20 text-foreground border border-primary/40";
    if (role === "ai") return "bg-accent/15 text-foreground border border-accent/40";
    return "bg-secondary/20 text-foreground border border-secondary/40";
  }
  function roleLabel(role: string) {
    if (role === "ai") return { icon: Bot, text: "AI Assistant" };
    if (role === "admin") return { icon: Shield, text: "Ghost Mods Team" };
    return { icon: User, text: "You" };
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-mono tracking-[0.3em] text-primary">// LIVE SUPPORT</p>
          <h1 className="text-3xl font-bold neon-text">Chat with Ghost Mods Tech</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {aiActive ? "AI assistant is answering — a human may join anytime." : "A live agent is handling this conversation."}
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full border ${aiActive ? "border-accent/50 text-accent" : "border-secondary/50 text-secondary-foreground"}`}>
          {aiActive ? "AI mode" : "Live agent"}
        </span>
      </div>
      <div className="glass-card rounded-xl border border-border/40 flex flex-col h-[calc(100vh-14rem)]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {(messages as any[]).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Say hi — we'll get back to you here and via notification.
            </p>
          )}
          {(messages as any[]).map((m) => {
            const { icon: Icon, text } = roleLabel(m.sender_role);
            const mine = m.sender_role === "user";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${bubbleStyle(m.sender_role)}`}>
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-70 mb-1">
                    <Icon className="h-3 w-3" /> {text}
                  </div>
                  {m.body}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })}
          {aiThinking && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-2.5 text-sm bg-accent/10 border border-accent/30 text-muted-foreground">
                <div className="flex items-center gap-1.5"><Bot className="h-3 w-3" /> AI is typing…</div>
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-border/40 p-3 flex gap-2 items-end">
          <Textarea
            rows={1}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            placeholder="Type a message…"
            className="min-h-[42px] resize-none"
          />
          <Button onClick={submit} disabled={sending || !body.trim()} className="glow-purple gap-1">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

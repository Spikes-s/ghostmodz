import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send, MessageCircle, Bot, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  listAllThreads, listThreadMessages, sendMessage, markThreadRead,
} from "@/lib/workflow.functions";
import { setThreadAiEnabled } from "@/lib/ai-support.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/support")({
  component: AdminSupport,
});

function AdminSupport() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAllThreads);
  const msgsFn = useServerFn(listThreadMessages);
  const sendFn = useServerFn(sendMessage);
  const readFn = useServerFn(markThreadRead);
  const toggleAiFn = useServerFn(setThreadAiEnabled);

  const { data: threads = [] } = useQuery({ queryKey: ["all-threads"], queryFn: () => listFn() });
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = (threads as any[]).find((t) => t.id === activeId) ?? null;

  const { data: messages = [] } = useQuery({
    queryKey: ["thread-msgs", activeId],
    queryFn: () => msgsFn({ data: { threadId: activeId! } }),
    enabled: !!activeId,
  });

  useEffect(() => {
    if (!activeId) return;
    readFn({ data: { threadId: activeId } }).then(() => qc.invalidateQueries({ queryKey: ["all-threads"] }));
  }, [activeId, readFn, qc]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-support-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["thread-msgs", activeId] });
        qc.invalidateQueries({ queryKey: ["all-threads"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "support_threads" }, () => {
        qc.invalidateQueries({ queryKey: ["all-threads"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, activeId]);

  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function submit() {
    const txt = body.trim();
    if (!txt || !activeId) return;
    setSending(true);
    try {
      await sendFn({ data: { threadId: activeId, body: txt } });
      setBody("");
      qc.invalidateQueries({ queryKey: ["thread-msgs", activeId] });
    } catch (e: any) {
      toast.error(e?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid grid-cols-[280px_1fr] gap-4 h-[calc(100vh-16rem)]">
      <div className="glass-card rounded-xl border border-border/40 overflow-y-auto">
        <div className="p-3 border-b border-border/40 flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Threads ({(threads as any[]).length})</span>
        </div>
        {(threads as any[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveId(t.id)}
            className={cn(
              "w-full text-left px-3 py-3 border-b border-border/20 hover:bg-primary/10 transition-colors",
              activeId === t.id && "bg-primary/20"
            )}
          >
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium truncate">
                {t.profile?.username || t.profile?.email?.split("@")[0] || "User"}
              </span>
              {t.unread_admin > 0 && (
                <span className="h-2 w-2 rounded-full bg-primary" />
              )}
            </div>
            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
              {new Date(t.last_message_at).toLocaleString()}
            </div>
          </button>
        ))}
      </div>
      <div className="glass-card rounded-xl border border-border/40 flex flex-col">
        {!active ? (
          <div className="grid place-items-center flex-1 text-sm text-muted-foreground">
            Select a thread
          </div>
        ) : (
          <>
            <div className="p-3 border-b border-border/40 flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-sm">
                  {active.profile?.full_name || active.profile?.username || active.profile?.email || "User"}
                </div>
                <div className="text-xs text-muted-foreground">{active.profile?.email}</div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${active.ai_enabled && !active.admin_active ? "border-accent/50 text-accent" : "border-primary/50 text-primary"}`}>
                  {active.ai_enabled && !active.admin_active ? <><Bot className="h-3 w-3" /> AI</> : <><Shield className="h-3 w-3" /> Admin</>}
                </span>
                <span className="text-muted-foreground">AI reply</span>
                <Switch
                  checked={!!active.ai_enabled && !active.admin_active}
                  onCheckedChange={async (v) => {
                    try {
                      await toggleAiFn({ data: { threadId: active.id, enabled: v } });
                      qc.invalidateQueries({ queryKey: ["all-threads"] });
                    } catch (e: any) {
                      toast.error(e?.message || "Failed");
                    }
                  }}
                />
              </div>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {(messages as any[]).map((m) => (
                <div key={m.id} className={`flex ${m.sender_role === "admin" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    m.sender_role === "admin"
                      ? "bg-primary/20 text-foreground border border-primary/40"
                      : "bg-secondary/20 text-foreground border border-secondary/40"
                  }`}>
                    {m.body}
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border/40 p-3 flex gap-2 items-end">
              <Textarea
                rows={1}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                placeholder="Reply as admin…"
                className="min-h-[42px] resize-none"
              />
              <Button onClick={submit} disabled={sending || !body.trim()} className="glow-purple gap-1">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listNotifications, markNotificationRead, markAllRead } from "@/lib/workflow.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const qc = useQueryClient();
  const listFn = useServerFn(listNotifications);
  const markFn = useServerFn(markNotificationRead);
  const allFn = useServerFn(markAllRead);
  const { data = [] } = useQuery({ queryKey: ["notifications"], queryFn: () => listFn() });
  const unread = (data as any[]).filter((n) => !n.read_at).length;
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`notif:${uid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [uid, qc]);

  async function markOne(id: string, link?: string | null) {
    await markFn({ data: { id } }).catch(() => undefined);
    qc.invalidateQueries({ queryKey: ["notifications"] });
    if (link) window.location.assign(link);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-md text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-primary text-[10px] text-primary-foreground grid place-items-center font-semibold">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 glass-card border-border/60">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={async () => {
              await allFn(); qc.invalidateQueries({ queryKey: ["notifications"] });
            }}>
              <Check className="h-3 w-3" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {(data as any[]).length === 0 && (
            <p className="p-6 text-sm text-center text-muted-foreground">No notifications yet</p>
          )}
          {(data as any[]).map((n) => (
            <button
              key={n.id}
              onClick={() => markOne(n.id, n.link)}
              className={cn(
                "w-full text-left px-3 py-2 border-b border-border/20 hover:bg-primary/5",
                !n.read_at && "bg-primary/5",
              )}
            >
              <div className="flex items-start gap-2">
                {!n.read_at && <span className="h-2 w-2 mt-1.5 rounded-full bg-primary shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{n.title}</div>
                  {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
                  <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.created_at).toLocaleString()}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

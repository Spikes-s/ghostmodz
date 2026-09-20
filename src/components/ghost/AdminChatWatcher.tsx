import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/use-is-admin";

/**
 * Live visitor-chat watcher for administrators.
 * Subscribes to new support messages and raises an in-app toast the moment a
 * visitor writes, with a one-click jump into the support console.
 */
export function AdminChatWatcher() {
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const lastSound = useRef(0);

  useEffect(() => {
    if (!isAdmin) return;

    function ping() {
      const now = Date.now();
      if (now - lastSound.current < 2500) return;
      lastSound.current = now;
      try {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.26);
        setTimeout(() => ctx.close().catch(() => {}), 500);
      } catch {
        /* audio is best effort */
      }
    }

    const channel = supabase
      .channel("admin-visitor-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        (payload: any) => {
          const row = payload.new;
          if (!row || row.sender_role !== "user") return;
          if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin/support")) return;
          ping();
          toast("New visitor message", {
            description: String(row.body ?? "").slice(0, 120),
            action: {
              label: "Open chat",
              onClick: () => navigate({ to: "/admin/support" }),
            },
            duration: 10000,
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_threads" },
        () => {
          ping();
          toast("A visitor started a new chat", {
            action: { label: "Open chat", onClick: () => navigate({ to: "/admin/support" }) },
            duration: 10000,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, navigate]);

  return null;
}

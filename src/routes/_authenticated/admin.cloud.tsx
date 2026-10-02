import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminCloudOverview, adminSetAppStatus, adminUpdateVps, adminSettleTransaction } from "@/lib/cloud.functions";

export const Route = createFileRoute("/_authenticated/admin/cloud")({
  head: () => ({ meta: [{ title: "Cloud Admin — Ghost Mods Tech" }, { name: "robots", content: "noindex" }] }),
  component: AdminCloud,
});

const who = (u: any) => u?.email || u?.username || "unknown";

function AdminCloud() {
  const fn = useServerFn(adminCloudOverview);
  const setApp = useServerFn(adminSetAppStatus);
  const setVps = useServerFn(adminUpdateVps);
  const settle = useServerFn(adminSettleTransaction);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-cloud"], queryFn: () => fn() });
  const done = { onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-cloud"] }); }, onError: (e: Error) => toast.error(e.message) };
  const app = useMutation({ mutationFn: (v: any) => setApp({ data: v }), ...done });
  const vps = useMutation({ mutationFn: (v: any) => setVps({ data: v }), ...done });
  const tx = useMutation({ mutationFn: (v: any) => settle({ data: v }), ...done });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const d: any = q.data;
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-bold mb-3">Pending top-ups</h2>
        {d.transactions.filter((t: any) => t.status === "pending").length === 0 && <p className="text-sm text-muted-foreground">None pending.</p>}
        <div className="space-y-2">
          {d.transactions.filter((t: any) => t.status === "pending").map((t: any) => (
            <div key={t.id} className="glass-card rounded-lg p-3 flex flex-wrap gap-3 items-center text-sm">
              <span className="font-medium">KES {t.amount}</span>
              <span className="text-muted-foreground">{t.method} · ref {t.reference ?? "—"} · {who(t.user)}</span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" onClick={() => tx.mutate({ txId: t.id, status: "confirmed" })}>Confirm</Button>
                <Button size="sm" variant="outline" onClick={() => tx.mutate({ txId: t.id, status: "rejected" })}>Reject</Button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-xl font-bold mb-3">Apps ({d.apps.length})</h2>
        {d.apps.length === 0 && <p className="text-sm text-muted-foreground">No apps yet.</p>}
        <div className="space-y-2">
          {d.apps.map((a: any) => (
            <div key={a.id} className="glass-card rounded-lg p-3 flex flex-wrap gap-3 items-center text-sm">
              <span className="font-medium">{a.name}</span>
              <span className="text-muted-foreground">{a.domain} · {who(a.user)}</span>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted">{a.status}</span>
              <div className="ml-auto flex gap-1 flex-wrap">
                {["live", "stopped", "failed", "suspended"].map((s) => (
                  <Button key={s} size="sm" variant="outline" onClick={() => app.mutate({ appId: a.id, status: s, health: s === "live" ? "healthy" : "unknown" })}>{s}</Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-xl font-bold mb-3">Servers ({d.vps.length})</h2>
        {d.vps.length === 0 && <p className="text-sm text-muted-foreground">No server requests yet.</p>}
        <div className="space-y-2">
          {d.vps.map((v: any) => (
            <div key={v.id} className="glass-card rounded-lg p-3 flex flex-wrap gap-3 items-center text-sm">
              <span className="font-medium">{v.hostname}</span>
              <span className="text-muted-foreground">{v.ip_address ?? "no IP"} · {who(v.user)}</span>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted">{v.status}</span>
              <div className="ml-auto flex gap-1 flex-wrap">
                <Button size="sm" onClick={() => {
                  const ip = prompt("Server IP address", v.ip_address ?? "");
                  if (ip !== null) vps.mutate({ vpsId: v.id, status: "active", ip_address: ip });
                }}>Activate</Button>
                {["suspended", "terminated"].map((s) => (
                  <Button key={s} size="sm" variant="outline" onClick={() => vps.mutate({ vpsId: v.id, status: s })}>{s}</Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

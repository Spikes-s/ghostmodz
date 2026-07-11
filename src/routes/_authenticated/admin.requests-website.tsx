import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Inbox, DollarSign, CheckCircle2, XCircle, MessageCircleQuestion, PlayCircle, Copy } from "lucide-react";
import {
  listAllRequests, sendQuote, updateRequestStatus, confirmPayment,
} from "@/lib/workflow.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/requests-website")({
  component: AdminRequests,
});

function AdminRequests() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAllRequests);
  const quoteFn = useServerFn(sendQuote);
  const statusFn = useServerFn(updateRequestStatus);
  const payFn = useServerFn(confirmPayment);

  const { data = [], isLoading } = useQuery({ queryKey: ["admin-requests"], queryFn: () => listFn() });
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = (data as any[]).find((r) => r.id === activeId) ?? null;

  const [form, setForm] = useState<{ price: string; days: string; deposit: string; notes: string }>({
    price: "", days: "", deposit: "50", notes: "",
  });

  function openDrawer(r: any) {
    setActiveId(r.id);
    setForm({
      price: r.estimated_price?.toString() || "",
      days: r.estimated_days?.toString() || "",
      deposit: (r.deposit_percent ?? 50).toString(),
      notes: r.admin_notes || "",
    });
  }

  async function sendQuoteAction() {
    if (!active) return;
    if (!form.price || !form.days) return toast.error("Set price and delivery days");
    try {
      const res = await quoteFn({
        data: {
          id: active.id,
          estimated_price: Number(form.price),
          estimated_days: Number(form.days),
          deposit_percent: Number(form.deposit),
          currency: "KES",
          admin_notes: form.notes,
        },
      });
      const url = `${window.location.origin}/pay/${(res as any).token}`;
      await navigator.clipboard.writeText(url).catch(() => undefined);
      toast.success("Quote sent — payment link copied");
      qc.invalidateQueries({ queryKey: ["admin-requests"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  }

  async function setStatus(status: any) {
    if (!active) return;
    try {
      await statusFn({ data: { id: active.id, status, admin_notes: form.notes } });
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["admin-requests"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
      <Card className="glass-card border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Inbox className="h-5 w-5 text-primary" /> Website Requests</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="p-2">Client</th>
                <th className="p-2">Type</th>
                <th className="p-2">Features</th>
                <th className="p-2">Status</th>
                <th className="p-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {(data as any[]).map((r) => (
                <tr
                  key={r.id}
                  onClick={() => openDrawer(r)}
                  className={cn("cursor-pointer border-t border-border/20 hover:bg-primary/5", activeId === r.id && "bg-primary/10")}
                >
                  <td className="p-2">
                    <div className="font-medium">{r.profile?.username || r.profile?.email?.split("@")[0] || "User"}</div>
                    <div className="text-xs text-muted-foreground">{r.profile?.email}</div>
                  </td>
                  <td className="p-2">
                    <div>{r.website_type || r.service_kind}</div>
                    {r.booking_type && <div className="text-xs text-muted-foreground">{r.booking_type}</div>}
                  </td>
                  <td className="p-2 text-xs">{(r.features || []).length}</td>
                  <td className="p-2"><Badge variant="outline" className="text-[10px] uppercase">{r.status}</Badge></td>
                  <td className="p-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {(data as any[]).length === 0 && !isLoading && (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No requests yet</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {active && (
        <Card className="glass-card border-primary/40 h-fit sticky top-24">
          <CardHeader>
            <CardTitle className="text-base">
              {active.website_type || active.service_kind} — {active.profile?.username || active.profile?.email}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Details</p>
              <div className="text-xs space-y-1 max-h-40 overflow-y-auto glass rounded p-2">
                {Object.entries(active.details || {}).map(([k, v]) => (
                  <div key={k}><span className="text-muted-foreground">{k}:</span> {String(v)}</div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Features ({(active.features || []).length})</p>
              <div className="flex flex-wrap gap-1">
                {(active.features || []).map((f: string) => (
                  <span key={f} className="text-[10px] rounded-full glass px-2 py-0.5">{f}</span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Price (KES)</Label>
                <Input value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Days</Label>
                <Input value={form.days} onChange={(e) => setForm((p) => ({ ...p, days: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Deposit %</Label>
                <Input value={form.deposit} onChange={(e) => setForm((p) => ({ ...p, deposit: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Admin notes / message</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <Button onClick={sendQuoteAction} className="w-full glow-purple gap-2">
              <DollarSign className="h-4 w-4" /> Send Quote
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setStatus("approved")} className="gap-1"><CheckCircle2 className="h-4 w-4 text-green-400" /> Approve</Button>
              <Button variant="outline" onClick={() => setStatus("rejected")} className="gap-1"><XCircle className="h-4 w-4 text-red-400" /> Reject</Button>
              <Button variant="outline" onClick={() => setStatus("info_requested")} className="gap-1"><MessageCircleQuestion className="h-4 w-4 text-amber-400" /> Info</Button>
              <Button variant="outline" onClick={() => setStatus("in_progress")} className="gap-1"><PlayCircle className="h-4 w-4 text-cyan-400" /> Start</Button>
            </div>
            {active.quote_token && (
              <div className="rounded-lg glass p-2 flex items-center justify-between text-xs">
                <span className="truncate">/pay/{active.quote_token.slice(0, 12)}…</span>
                <Button size="sm" variant="ghost" onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/pay/${active.quote_token}`);
                  toast.success("Copied");
                }}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}
            <PaymentsList
              requestId={active.id}
              onConfirm={async (id) => {
                try { await payFn({ data: { id } }); toast.success("Confirmed"); qc.invalidateQueries({ queryKey: ["admin-requests"] }); }
                catch (e: any) { toast.error(e?.message || "Failed"); }
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PaymentsList({ requestId, onConfirm }: { requestId: string; onConfirm: (id: string) => void }) {
  // Reuse listAllRequests payload doesn't include payments; simple fetch via supabase client
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    let active = true;
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase.from("payments").select("*").eq("request_id", requestId).order("created_at", { ascending: false })
        .then(({ data }) => { if (active) setRows(data ?? []); });
    });
    return () => { active = false; };
  }, [requestId]);
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Payments</p>
      {rows.map((p) => (
        <div key={p.id} className="flex items-center justify-between text-xs rounded glass p-2">
          <div>
            <div className="font-medium">{p.currency} {Number(p.amount).toLocaleString()}</div>
            <div className="text-muted-foreground">{p.method} · {p.status}</div>
          </div>
          {p.status === "pending_confirmation" && (
            <Button size="sm" onClick={() => onConfirm(p.id)}>Confirm</Button>
          )}
        </div>
      ))}
    </div>
  );
}

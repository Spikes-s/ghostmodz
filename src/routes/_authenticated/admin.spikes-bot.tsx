import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Activity, Bot, Check, Clock3, Link2, Loader2, Power, RefreshCw, ShieldAlert, Smartphone, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSpikesEngineActivity, getSpikesEngineCommands, getSpikesEngineStatus, pairSpikesWhatsApp, reconnectSpikesEngine, disconnectSpikesEngine, setSpikesCommandState, type SpikesEngineActivity, type SpikesEngineCommand } from "@/lib/spikes-engine.functions";

export const Route = createFileRoute("/_authenticated/admin/spikes-bot")({
  head: () => ({ meta: [{ title: "Spikes Bot Control — Ghost Mods Tech" }, { name: "description", content: "Owner controls and live status for the Spikes WhatsApp bot service." }, { property: "og:title", content: "Spikes Bot Control — Ghost Mods Tech" }, { property: "og:description", content: "Manage the linked WhatsApp service and verified bot commands." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: SpikesBotAdmin,
});

type Status = { configured: boolean; state: string; message?: string; linkedNumber?: string | null; connectedAt?: string | null; uptimeSeconds?: number; ownerConfigured?: boolean; prefix?: string };
type Command = SpikesEngineCommand;
type ActivityRow = SpikesEngineActivity;

const stateLabels: Record<string, string> = { not_configured: "Setup needed", unreachable: "Service offline", disconnected: "Disconnected", connecting: "Connecting", pairing: "Pairing pending", connected: "Connected", logged_out: "Logged out", error: "Service error" };

function SpikesBotAdmin() {
  const qc = useQueryClient();
  const statusFn = useServerFn(getSpikesEngineStatus);
  const commandsFn = useServerFn(getSpikesEngineCommands);
  const activityFn = useServerFn(getSpikesEngineActivity);
  const pairFn = useServerFn(pairSpikesWhatsApp);
  const reconnectFn = useServerFn(reconnectSpikesEngine);
  const disconnectFn = useServerFn(disconnectSpikesEngine);
  const toggleFn = useServerFn(setSpikesCommandState);
  const [number, setNumber] = useState("");
  const [pairCode, setPairCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [pendingAction, setPendingAction] = useState("");

  const status = useQuery({ queryKey: ["spikes-engine-status"], queryFn: () => statusFn(), refetchInterval: 10000, retry: 1 });
  const commands = useQuery<Command[]>({ queryKey: ["spikes-engine-commands"], queryFn: () => commandsFn(), enabled: status.data?.configured === true, retry: 1 });
  const activity = useQuery<ActivityRow[]>({ queryKey: ["spikes-engine-activity"], queryFn: () => activityFn(), enabled: status.data?.configured === true, refetchInterval: 15000, retry: 1 });
  const codeRemaining = useMemo(() => pairCode ? Math.max(0, Math.ceil((Date.parse(pairCode.expiresAt) - now) / 1000)) : 0, [pairCode, now]);

  useEffect(() => {
    if (!pairCode) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pairCode]);
  useEffect(() => {
    if (pairCode && codeRemaining === 0) setPairCode(null);
  }, [pairCode, codeRemaining]);

  async function run(action: string, task: () => Promise<unknown>) {
    setPendingAction(action);
    try {
      await task();
      await Promise.all([qc.invalidateQueries({ queryKey: ["spikes-engine-status"] }), qc.invalidateQueries({ queryKey: ["spikes-engine-commands"] }), qc.invalidateQueries({ queryKey: ["spikes-engine-activity"] })]);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That action could not be completed.");
      return false;
    } finally {
      setPendingAction("");
    }
  }

  async function pair() {
    const phoneNumber = number.trim();
    if (!/^\+?[1-9]\d{6,14}$/.test(phoneNumber)) {
      toast.error("Enter a valid phone number with its country code.");
      return;
    }
    setPendingAction("pair");
    try {
      const result = await pairFn({ data: { phoneNumber } });
      setPairCode(result);
      setNow(Date.now());
      toast.success("A live pairing code was returned by the Spikes service.");
      void qc.invalidateQueries({ queryKey: ["spikes-engine-status"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pairing could not be started.");
    } finally {
      setPendingAction("");
    }
  }

  const data = status.data as Status | undefined;
  const stateLabel = data ? stateLabels[data.state] ?? data.state : "Checking service";
  const stateTone = data?.state === "connected" ? "text-emerald-400" : data?.state === "unreachable" || data?.state === "error" ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-2xl font-display font-bold">Spikes Bot</h2><p className="text-sm text-muted-foreground">WhatsApp link, commands, and service activity</p></div>
        <Button variant="outline" size="sm" onClick={() => { void status.refetch(); void commands.refetch(); void activity.refetch(); }} disabled={status.isFetching} className="gap-2"><RefreshCw className={`h-4 w-4 ${status.isFetching ? "animate-spin" : ""}`} />Refresh</Button>
      </div>

      {!data && <Card className="glass-card"><CardContent className="flex items-center gap-3 p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking the live Spikes service…</CardContent></Card>}

      {data && !data.configured && <Card className="glass-card border-secondary/40"><CardContent className="flex gap-3 p-5"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-secondary" /><div><h3 className="font-semibold">The live service has not been connected</h3><p className="mt-1 text-sm text-muted-foreground">Deploy the included Spikes service on a persistent Node host, then add its HTTPS address and shared access token to the app’s private settings. Pairing and commands stay unavailable until then.</p></div></CardContent></Card>}

      {data && <Card className="glass-card border-border/40"><CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle className="flex items-center gap-2 text-base"><Bot className="h-5 w-5 text-primary" />WhatsApp connection</CardTitle><Badge variant="outline" className={stateTone}><span className={`mr-2 inline-block h-2 w-2 rounded-full ${data.state === "connected" ? "bg-emerald-400" : data.state === "connecting" || data.state === "pairing" ? "bg-secondary animate-pulse" : "bg-muted-foreground"}`} />{stateLabel}</Badge></CardHeader><CardContent className="space-y-5">
        {data.message && <p className="text-sm text-muted-foreground">{data.message}</p>}
        {data.configured && <>
          <div className="grid gap-3 sm:grid-cols-3">
            <InfoCell icon={Smartphone} label="Linked number" value={data.linkedNumber || "Not linked"} />
            <InfoCell icon={Clock3} label="Connected since" value={data.connectedAt ? new Date(data.connectedAt).toLocaleString() : "—"} />
            <InfoCell icon={Activity} label="Service uptime" value={formatUptime(data.uptimeSeconds ?? 0)} />
          </div>
          <form className="grid gap-3 border-t border-border/40 pt-4 sm:grid-cols-[1fr_auto]" onSubmit={(event) => { event.preventDefault(); void pair(); }}>
            <div className="space-y-1.5"><label htmlFor="spikes-phone" className="text-sm font-medium">Dedicated WhatsApp number</label><Input id="spikes-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+254712345678" value={number} onChange={(event) => setNumber(event.target.value)} disabled={data.state === "connected" || data.state === "pairing"} /><p className="text-xs text-muted-foreground">Include country code. Only the real service can issue a pairing code.</p></div>
            <div className="flex items-end"><Button type="submit" disabled={pendingAction !== "" || !number.trim() || data.state === "connected" || data.state === "pairing"} className="w-full gap-2 sm:w-auto"><Link2 className="h-4 w-4" />{pendingAction === "pair" ? "Requesting…" : "Generate pairing code"}</Button></div>
          </form>
          {pairCode && codeRemaining > 0 && <div className="rounded-md border border-primary/40 bg-primary/5 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-muted-foreground">Live pairing code · expires in {Math.floor(codeRemaining / 60)}:{String(codeRemaining % 60).padStart(2, "0")}</p><p className="mt-1 font-mono text-3xl font-bold tracking-[0.16em] text-primary">{pairCode.code}</p></div><Button type="button" variant="ghost" size="icon" aria-label="Copy pairing code" onClick={() => { void navigator.clipboard.writeText(pairCode.code).then(() => toast.success("Pairing code copied.")); }}><Check className="h-4 w-4" /></Button></div><ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-muted-foreground"><li>Open WhatsApp on the dedicated phone.</li><li>Go to Linked devices and choose to link using a phone number.</li><li>Enter this code and wait for the live status to change to Connected.</li></ol></div>}
          <div className="flex flex-wrap gap-2 border-t border-border/40 pt-4"><Button variant="outline" size="sm" className="gap-2" disabled={pendingAction !== ""} onClick={() => void run("reconnect", () => reconnectFn())}><Power className="h-4 w-4" />{pendingAction === "reconnect" ? "Reconnecting…" : "Reconnect"}</Button><Button variant="outline" size="sm" className="gap-2" disabled={pendingAction !== "" || data.state === "disconnected"} onClick={() => { if (window.confirm("Disconnect the WhatsApp account and erase its saved linked-device session?")) { setPairCode(null); void run("disconnect", () => disconnectFn()); } }}><Unplug className="h-4 w-4" />Disconnect</Button></div>
        </>}
      </CardContent></Card>}

      {data?.configured && <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"><Card className="glass-card border-border/40"><CardHeader><CardTitle className="text-base">Command readiness</CardTitle></CardHeader><CardContent className="space-y-2">{commands.data?.map((item: Command) => <div key={item.name} className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 py-2 last:border-0"><div className="min-w-0"><p className="font-mono text-sm">{data.prefix || "."}{item.name} <span className="font-sans text-xs text-muted-foreground">· {item.description}</span></p><p className="mt-0.5 text-xs text-muted-foreground">{item.category} {item.readiness === "missing_configuration" ? `· Needs ${item.missingConfiguration?.join(", ")}` : "· Ready"}</p></div><div className="flex items-center gap-2"><Badge variant="outline" className={item.readiness === "ready" ? "text-emerald-400" : "text-secondary"}>{item.readiness === "ready" ? "Ready" : "Unavailable"}</Badge><Button size="sm" variant={item.enabled ? "outline" : "secondary"} disabled={pendingAction !== "" || item.readiness !== "ready"} onClick={() => void run(`cmd-${item.name}`, () => toggleFn({ data: { name: item.name, enabled: !item.enabled } }))}>{item.enabled ? "Enabled" : "Disabled"}</Button></div></div>)}{commands.isError && <p className="py-3 text-sm text-destructive">Command list could not be loaded. Check that the service is online.</p>}{commands.data?.length === 0 && <p className="text-sm text-muted-foreground">No commands were returned by the service.</p>}</CardContent></Card>
        <Card className="glass-card border-border/40"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-primary" />Recent command activity</CardTitle></CardHeader><CardContent className="space-y-3">{activity.data?.length ? activity.data.map((item: ActivityRow, index: number) => <div key={`${item.at}-${index}`} className="flex items-center justify-between gap-3 border-b border-border/30 pb-2 last:border-0"><div><p className="font-mono text-sm">{data.prefix || "."}{item.command}</p><p className="text-xs text-muted-foreground">{item.chatType} · {new Date(item.at).toLocaleString()}</p></div><Badge variant="outline" className={item.result === "success" ? "text-emerald-400" : "text-destructive"}>{item.result}</Badge></div>) : <p className="text-sm text-muted-foreground">No command activity has been recorded by the live service yet.</p>}{activity.isError && <p className="text-xs text-destructive">Activity could not be refreshed.</p>}</CardContent></Card></div>}
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldAlert className="h-3.5 w-3.5" />Only implemented and configured commands are shown as ready. This dashboard never simulates WhatsApp connectivity.</p>
    </div>
  );
}

function InfoCell({ icon: Icon, label, value }: { icon: typeof Smartphone; label: string; value: string }) {
  return <div className="rounded-md border border-border/40 bg-background/30 p-3"><p className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</p><p className="mt-1 break-all text-sm font-medium">{value}</p></div>;
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [d ? `${d}d` : "", h ? `${h}h` : "", `${m}m`].filter(Boolean).join(" ");
}
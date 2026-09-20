import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Cloud, Rocket, Server, Wallet, Plus, Activity, HardDrive, Cpu, MemoryStick,
  Globe, CheckCircle2, Clock, CircleSlash,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getCloudOverview, requestVps, requestTopUp } from "@/lib/cloud.functions";

export const Route = createFileRoute("/_authenticated/cloud/")({
  component: CloudDashboard,
  head: () => ({
    meta: [
      { title: "Ghost Cloud — Deploy apps, bots and VPS" },
      { name: "description", content: "Ghost Cloud is the Ghost Mods Tech app platform: deploy GitHub repos, run bots 24/7, and provision VPS servers with wallet billing." },
      { property: "og:title", content: "Ghost Cloud — Deploy apps, bots and VPS" },
      { property: "og:description", content: "Deploy from GitHub, monitor health and provision VPS servers from one console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const money = (n: number | string) =>
  `KES ${Number(n).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

const STATUS_STYLE: Record<string, string> = {
  live: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  deploying: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  provisioning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  suspended: "bg-destructive/15 text-destructive border-destructive/30",
  stopped: "bg-muted text-muted-foreground border-border",
};

function StatusBadge({ value }: { value: string }) {
  return (
    <Badge variant="outline" className={STATUS_STYLE[value] ?? "bg-muted text-muted-foreground"}>
      {value}
    </Badge>
  );
}

function CloudDashboard() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(getCloudOverview);
  const vpsFn = useServerFn(requestVps);
  const topUpFn = useServerFn(requestTopUp);

  const { data, isLoading } = useQuery({ queryKey: ["cloud-overview"], queryFn: () => overviewFn() });

  const [vpsForm, setVpsForm] = useState({
    hostname: "", plan_id: "", region: "eu-central", os_image: "ubuntu-24.04", notes: "",
  });
  const [topUp, setTopUp] = useState({ amount: "500", method: "mpesa", reference: "" });
  const [busy, setBusy] = useState(false);

  if (isLoading || !data) return <div className="mx-auto max-w-7xl px-6 py-10 text-sm text-muted-foreground">Loading Ghost Cloud…</div>;

  const appPlans = data.plans.filter((p: any) => p.category === "app");
  const vpsPlans = data.plans.filter((p: any) => p.category === "vps");
  const otherPlans = data.plans.filter((p: any) => p.category !== "app" && p.category !== "vps");
  const liveApps = data.apps.filter((a: any) => a.status === "live").length;

  async function submitVps() {
    if (!vpsForm.plan_id) return toast.error("Choose a VPS plan");
    setBusy(true);
    try {
      await vpsFn({ data: { ...vpsForm } as any });
      toast.success("VPS request submitted — our operators will provision it shortly.");
      setVpsForm({ hostname: "", plan_id: "", region: "eu-central", os_image: "ubuntu-24.04", notes: "" });
      qc.invalidateQueries({ queryKey: ["cloud-overview"] });
    } catch (e: any) { toast.error(e?.message || "Failed"); } finally { setBusy(false); }
  }

  async function submitTopUp() {
    setBusy(true);
    try {
      await topUpFn({ data: { amount: Number(topUp.amount), method: topUp.method as any, reference: topUp.reference } });
      toast.success("Top-up submitted. It appears in your balance once confirmed.");
      setTopUp({ amount: "500", method: "mpesa", reference: "" });
      qc.invalidateQueries({ queryKey: ["cloud-overview"] });
    } catch (e: any) { toast.error(e?.message || "Failed"); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-secondary uppercase">
            <Cloud className="h-4 w-4" /> Ghost Cloud
          </div>
          <h1 className="text-3xl font-bold neon-text mt-1">Deploy, run and scale</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Push a public GitHub repo, keep bots alive 24/7, and provision root VPS servers — all billed from one wallet.
          </p>
        </div>
        <Link to="/cloud/new">
          <Button className="glow-purple gap-2"><Plus className="h-4 w-4" /> New deployment</Button>
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Apps", value: data.apps.length, icon: Rocket },
          { label: "Live", value: liveApps, icon: Activity },
          { label: "VPS", value: data.vps.length, icon: Server },
          { label: "Wallet", value: money(data.wallet.balance), icon: Wallet },
        ].map((s) => (
          <Card key={s.label} className="glass-card border-border/40">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold mt-1">{s.value}</p>
              </div>
              <s.icon className="h-6 w-6 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="apps">
        <TabsList className="flex-wrap">
          <TabsTrigger value="apps">Apps</TabsTrigger>
          <TabsTrigger value="vps">VPS</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
        </TabsList>

        {/* ---------------- APPS ---------------- */}
        <TabsContent value="apps" className="mt-6">
          {data.apps.length === 0 ? (
            <Card className="glass-card border-border/40">
              <CardContent className="p-10 text-center space-y-3">
                <Rocket className="h-8 w-8 mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">No apps yet. Paste a public GitHub repo and deploy in under a minute.</p>
                <Link to="/cloud/new"><Button className="gap-2"><Plus className="h-4 w-4" /> Deploy your first app</Button></Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {data.apps.map((a: any) => (
                <Link key={a.id} to="/cloud/apps/$appId" params={{ appId: a.id }}>
                  <Card className="glass-card border-border/40 hover-glow h-full">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{a.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{a.domain}</p>
                        </div>
                        <StatusBadge value={a.status} />
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" /> {a.region}</span>
                        <span className="inline-flex items-center gap-1"><Cpu className="h-3 w-3" /> {a.runtime}</span>
                        <span className="inline-flex items-center gap-1"><Activity className="h-3 w-3" /> {a.health}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{a.repo_url}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ---------------- VPS ---------------- */}
        <TabsContent value="vps" className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card className="glass-card border-border/40">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Server className="h-5 w-5 text-secondary" /> Your servers</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.vps.length === 0 && <p className="text-sm text-muted-foreground">No servers yet.</p>}
              {data.vps.map((v: any) => (
                <div key={v.id} className="rounded-lg border border-border/40 p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium font-mono text-sm">{v.hostname}</p>
                    <StatusBadge value={v.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{v.os_image} · {v.region}</p>
                  {v.ip_address && <p className="text-xs font-mono text-secondary">ssh {v.root_user}@{v.ip_address}</p>}
                  {v.notes && <p className="text-xs text-muted-foreground">{v.notes}</p>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="glass-card border-border/40">
            <CardHeader><CardTitle className="text-lg">Provision a VPS</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Hostname</Label>
                <Input placeholder="bots.myproject.io" value={vpsForm.hostname}
                  onChange={(e) => setVpsForm({ ...vpsForm, hostname: e.target.value.toLowerCase() })} />
              </div>
              <div>
                <Label>Plan</Label>
                <Select value={vpsForm.plan_id} onValueChange={(v) => setVpsForm({ ...vpsForm, plan_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose a plan" /></SelectTrigger>
                  <SelectContent>
                    {vpsPlans.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — {money(p.price_monthly)}/mo</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Region</Label>
                  <Select value={vpsForm.region} onValueChange={(v) => setVpsForm({ ...vpsForm, region: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["eu-central", "eu-west", "us-east", "af-south"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>OS image</Label>
                  <Select value={vpsForm.os_image} onValueChange={(v) => setVpsForm({ ...vpsForm, os_image: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["ubuntu-24.04", "ubuntu-22.04", "debian-12", "almalinux-9"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Notes for the operator</Label>
                <Textarea rows={2} value={vpsForm.notes} onChange={(e) => setVpsForm({ ...vpsForm, notes: e.target.value })} />
              </div>
              <Button disabled={busy} onClick={submitVps} className="w-full glow-purple">Request server</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- PLANS ---------------- */}
        <TabsContent value="plans" className="mt-6 space-y-8">
          {[
            { title: "App hosting", list: appPlans },
            { title: "VPS servers", list: vpsPlans },
            { title: "Data & add-ons", list: otherPlans },
          ].map((group) => (
            <section key={group.title} className="space-y-4">
              <h2 className="text-lg font-semibold">{group.title}</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {group.list.map((p: any) => (
                  <Card key={p.id} className={`glass-card border-border/40 h-full ${p.popular ? "neon-border" : ""}`}>
                    <CardContent className="p-5 space-y-3">
                      {p.popular && <Badge className="bg-primary/20 text-primary border-primary/40">Most popular</Badge>}
                      <div>
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.tagline}</p>
                      </div>
                      <p className="text-2xl font-bold">{Number(p.price_monthly) === 0 ? "Free" : money(p.price_monthly)}
                        <span className="text-xs font-normal text-muted-foreground">{Number(p.price_monthly) === 0 ? "" : "/mo"}</span>
                      </p>
                      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Cpu className="h-3 w-3" />{p.cpu_cores} vCPU</span>
                        <span className="inline-flex items-center gap-1"><MemoryStick className="h-3 w-3" />{p.ram_mb} MB</span>
                        <span className="inline-flex items-center gap-1"><HardDrive className="h-3 w-3" />{p.disk_gb} GB</span>
                      </div>
                      <ul className="space-y-1">
                        {(p.features as string[]).map((f) => (
                          <li key={f} className="flex gap-2 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0 mt-0.5" /> {f}
                          </li>
                        ))}
                      </ul>
                      {p.category === "app" && (
                        <Link to="/cloud/new"><Button size="sm" variant="outline" className="w-full">Deploy here</Button></Link>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </TabsContent>

        {/* ---------------- WALLET ---------------- */}
        <TabsContent value="wallet" className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card className="glass-card border-border/40">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> Balance</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-4xl font-bold neon-text">{money(data.wallet.balance)}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Amount (KES)</Label>
                  <Input type="number" value={topUp.amount} onChange={(e) => setTopUp({ ...topUp, amount: e.target.value })} />
                </div>
                <div>
                  <Label>Method</Label>
                  <Select value={topUp.method} onValueChange={(v) => setTopUp({ ...topUp, method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mpesa">M-Pesa</SelectItem>
                      <SelectItem value="paystack">Paystack</SelectItem>
                      <SelectItem value="bank">Bank transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Payment reference / code</Label>
                <Input value={topUp.reference} onChange={(e) => setTopUp({ ...topUp, reference: e.target.value })} placeholder="e.g. M-Pesa confirmation code" />
              </div>
              <Button disabled={busy} onClick={submitTopUp} className="w-full glow-purple">Submit top-up</Button>
              <p className="text-xs text-muted-foreground">
                An administrator confirms every payment before it is credited.
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/40">
            <CardHeader><CardTitle className="text-lg">Transactions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.transactions.length === 0 && <p className="text-sm text-muted-foreground">Nothing yet.</p>}
              {data.transactions.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-border/40 p-3 text-sm">
                  <div>
                    <p className="font-medium capitalize">{t.kind} · {t.method}</p>
                    <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono">{t.kind === "charge" ? "-" : "+"}{money(t.amount)}</p>
                    <p className="text-xs inline-flex items-center gap-1 text-muted-foreground">
                      {t.status === "confirmed" ? <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        : t.status === "pending" ? <Clock className="h-3 w-3 text-amber-400" />
                        : <CircleSlash className="h-3 w-3 text-destructive" />} {t.status}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

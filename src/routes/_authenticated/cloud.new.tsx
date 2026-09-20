import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Github, Search, Rocket, Plus, Trash2, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  listHostingPlans, inspectRepository, createCloudApp, deployCloudApp,
} from "@/lib/cloud.functions";

export const Route = createFileRoute("/_authenticated/cloud/new")({
  component: NewDeployment,
  head: () => ({
    meta: [
      { title: "New deployment — Ghost Cloud" },
      { name: "description", content: "Deploy a public GitHub repository to Ghost Cloud: pick a plan, set environment variables and ship." },
      { property: "og:title", content: "New deployment — Ghost Cloud" },
      { property: "og:description", content: "Pick a repo, a plan and a region, then deploy in one click." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function NewDeployment() {
  const navigate = useNavigate();
  const plansFn = useServerFn(listHostingPlans);
  const inspectFn = useServerFn(inspectRepository);
  const createFn = useServerFn(createCloudApp);
  const deployFn = useServerFn(deployCloudApp);

  const { data: plans = [] } = useQuery({ queryKey: ["hosting-plans"], queryFn: () => plansFn() });
  const appPlans = (plans as any[]).filter((p) => p.category === "app" && p.active);

  const [repo, setRepo] = useState("");
  const [meta, setMeta] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [form, setForm] = useState({
    name: "", branch: "main", runtime: "node", region: "eu-central", plan_id: "", start_command: "",
  });
  const [env, setEnv] = useState<{ k: string; v: string }[]>([]);
  const [busy, setBusy] = useState(false);

  async function check() {
    setChecking(true);
    try {
      const m = await inspectFn({ data: { repo_url: repo.trim() } });
      setMeta(m);
      setForm((f) => ({
        ...f,
        name: f.name || m.full_name.split("/")[1],
        branch: m.default_branch,
        runtime: m.runtime,
      }));
      toast.success(`Found ${m.full_name}`);
    } catch (e: any) {
      setMeta(null);
      toast.error(e?.message || "Could not read that repository");
    } finally { setChecking(false); }
  }

  async function submit() {
    if (!form.plan_id) return toast.error("Choose a plan");
    setBusy(true);
    try {
      const env_vars = Object.fromEntries(env.filter((e) => e.k.trim()).map((e) => [e.k.trim(), e.v]));
      const app = await createFn({ data: { ...form, repo_url: repo.trim(), env_vars } as any });
      await deployFn({ data: { appId: app.id, trigger: "manual" } });
      toast.success("App created and first deploy started");
      navigate({ to: "/cloud/apps/$appId", params: { appId: app.id } });
    } catch (e: any) { toast.error(e?.message || "Failed"); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 space-y-6">
      <button onClick={() => navigate({ to: "/cloud" })} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Ghost Cloud
      </button>
      <h1 className="text-3xl font-bold neon-text">New deployment</h1>

      <Card className="glass-card border-border/40">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Github className="h-5 w-5" /> Repository</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="https://github.com/owner/repo" value={repo} onChange={(e) => setRepo(e.target.value)} />
            <Button variant="outline" disabled={!repo.trim() || checking} onClick={check} className="gap-2">
              <Search className="h-4 w-4" /> {checking ? "Checking…" : "Check"}
            </Button>
          </div>
          {meta && (
            <div className="rounded-lg border border-border/40 p-4 space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{meta.full_name}</p>
                {meta.language && <Badge variant="outline">{meta.language}</Badge>}
                <Badge variant="outline">★ {meta.stars}</Badge>
              </div>
              {meta.description && <p className="text-xs text-muted-foreground">{meta.description}</p>}
              <p className="text-xs text-muted-foreground">
                Default branch {meta.default_branch} · {Math.round(meta.size_kb / 1024)} MB · last push {new Date(meta.updated_at).toLocaleDateString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card border-border/40">
        <CardHeader><CardTitle className="text-lg">Configuration</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>App name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Branch</Label>
            <Input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} />
          </div>
          <div>
            <Label>Runtime</Label>
            <Select value={form.runtime} onValueChange={(v) => setForm({ ...form, runtime: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["node", "python", "php", "go", "java", "ruby", "dotnet", "other"].map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Region</Label>
            <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["eu-central", "eu-west", "us-east", "af-south"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Plan</Label>
            <Select value={form.plan_id} onValueChange={(v) => setForm({ ...form, plan_id: v })}>
              <SelectTrigger><SelectValue placeholder="Choose an app plan" /></SelectTrigger>
              <SelectContent>
                {appPlans.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {Number(p.price_monthly) === 0 ? "Free" : `KES ${p.price_monthly}/mo`} · {p.ram_mb} MB RAM
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Start command (optional)</Label>
            <Input placeholder="npm start" value={form.start_command} onChange={(e) => setForm({ ...form, start_command: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-border/40">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Environment variables</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setEnv([...env, { k: "", v: "" }])} className="gap-1">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {env.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
          {env.map((row, i) => (
            <div key={i} className="flex gap-2">
              <Input placeholder="KEY" value={row.k} onChange={(e) => {
                const n = [...env]; n[i] = { ...n[i], k: e.target.value.toUpperCase() }; setEnv(n);
              }} />
              <Input placeholder="value" value={row.v} onChange={(e) => {
                const n = [...env]; n[i] = { ...n[i], v: e.target.value }; setEnv(n);
              }} />
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setEnv(env.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button disabled={busy || !repo.trim() || !form.name} onClick={submit} className="glow-purple gap-2">
          <Rocket className="h-4 w-4" /> {busy ? "Deploying…" : "Create & deploy"}
        </Button>
      </div>
    </div>
  );
}

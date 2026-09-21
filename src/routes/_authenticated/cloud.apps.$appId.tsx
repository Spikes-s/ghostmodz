import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Activity, Cpu, Globe, Rocket, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { BrandedLoader } from "@/components/ghost/BrandedLoader";
import { getCloudApp, updateCloudApp, deployCloudApp, deleteCloudApp } from "@/lib/cloud.functions";

export const Route = createFileRoute("/_authenticated/cloud/apps/$appId")({
  head: () => ({
    meta: [
      { title: "App Console — Ghost Cloud" },
      { name: "description", content: "Manage your deployment: branch, environment variables, build logs and status." },
      { property: "og:title", content: "App Console — Ghost Cloud" },
      { property: "og:description", content: "Manage your deployment, environment variables and build logs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CloudAppPage,
});

function envToText(env: Record<string, string>) {
  return Object.entries(env ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
}

function textToEnv(text: string) {
  const out: Record<string, string> = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 1) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

function CloudAppPage() {
  const { appId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const load = useServerFn(getCloudApp);
  const save = useServerFn(updateCloudApp);
  const deploy = useServerFn(deployCloudApp);
  const remove = useServerFn(deleteCloudApp);

  const { data, isLoading } = useQuery({
    queryKey: ["cloud-app", appId],
    queryFn: () => load({ data: { appId } }),
  });

  const [branch, setBranch] = useState("");
  const [startCommand, setStartCommand] = useState("");
  const [envText, setEnvText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const app = data?.app as any;
    if (!app) return;
    setBranch(app.branch ?? "main");
    setStartCommand(app.start_command ?? "");
    setEnvText(envToText(app.env_vars ?? {}));
  }, [data]);

  if (isLoading) return <BrandedLoader label="Opening your app console…" />;
  if (!data) return <div className="p-10 text-center text-muted-foreground">App not found.</div>;

  const app = data.app as any;
  const deployments = (data.deployments ?? []) as any[];
  const plan = data.plan as any;

  async function onSave() {
    setBusy(true);
    try {
      await save({ data: { appId, branch, start_command: startCommand, env_vars: textToEnv(envText) } });
      await qc.invalidateQueries({ queryKey: ["cloud-app", appId] });
      toast.success("Settings saved");
    } catch (e: any) {
      toast.error(e?.message || "Could not save settings");
    } finally {
      setBusy(false);
    }
  }

  async function onDeploy() {
    setBusy(true);
    try {
      await deploy({ data: { appId, trigger: "manual" } });
      await qc.invalidateQueries({ queryKey: ["cloud-app", appId] });
      toast.success("Deployment started");
    } catch (e: any) {
      toast.error(e?.message || "Deployment failed to start");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!confirm("Delete this app permanently?")) return;
    setBusy(true);
    try {
      await remove({ data: { appId } });
      toast.success("App deleted");
      navigate({ to: "/cloud" });
    } catch (e: any) {
      toast.error(e?.message || "Could not delete the app");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Button variant="ghost" size="sm" className="mb-4 gap-2" onClick={() => navigate({ to: "/cloud" })}>
        <ArrowLeft className="h-4 w-4" /> Cloud
      </Button>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-primary">// APP CONSOLE</p>
          <h1 className="text-3xl font-bold neon-text">{app.name}</h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{app.domain}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" /> {app.region}</span>
            <span className="inline-flex items-center gap-1"><Cpu className="h-3 w-3" /> {app.runtime}</span>
            <span className="inline-flex items-center gap-1"><Activity className="h-3 w-3" /> {app.health}</span>
            {plan && <span>{plan.name}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="border border-primary/40 bg-primary/15 text-primary capitalize">{app.status}</Badge>
          <Button onClick={onDeploy} disabled={busy} className="gap-2 glow-purple">
            <Rocket className="h-4 w-4" /> Deploy
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="glass-card border-border/40">
          <CardHeader><CardTitle className="text-base">Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Repository</Label>
              <p className="truncate font-mono text-xs text-muted-foreground">{app.repo_url}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="branch">Branch</Label>
              <Input id="branch" value={branch} onChange={(e) => setBranch(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="start">Start command</Label>
              <Input
                id="start"
                value={startCommand}
                onChange={(e) => setStartCommand(e.target.value)}
                placeholder="npm start"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="env">Environment variables</Label>
              <Textarea
                id="env"
                rows={6}
                value={envText}
                onChange={(e) => setEnvText(e.target.value)}
                placeholder={"KEY=value\nANOTHER=value"}
                className="font-mono text-xs"
              />
            </div>
            <div className="flex items-center justify-between">
              <Button onClick={onSave} disabled={busy} className="gap-2">
                <Save className="h-4 w-4" /> Save
              </Button>
              <Button onClick={onDelete} disabled={busy} variant="ghost" className="gap-2 text-destructive">
                <Trash2 className="h-4 w-4" /> Delete app
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/40">
          <CardHeader><CardTitle className="text-base">Deployments</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {deployments.length === 0 && (
              <p className="text-sm text-muted-foreground">No deployments yet. Hit Deploy to start the first build.</p>
            )}
            {deployments.map((d) => (
              <details key={d.id} className="rounded-lg border border-border/40 p-3">
                <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                  <span className="capitalize">{d.status}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {new Date(d.created_at).toLocaleString()}
                  </span>
                </summary>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-background/60 p-3 font-mono text-[11px] text-muted-foreground">
                  {d.logs}
                </pre>
              </details>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

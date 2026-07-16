import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Code2, Plus } from "lucide-react";
import { createApiProject, listMyApiProjects } from "@/lib/api-projects.functions";

export const Route = createFileRoute("/_authenticated/services/api-dev/new")({
  head: () => ({ meta: [{ title: "API Development — Ghost Mods Tech" }] }),
  component: ApiDevNew,
});

const TYPES = ["REST", "GraphQL", "Webhook", "Auth", "Payment", "FileUpload", "Custom"] as const;
const AUTHS = [
  { v: "none", l: "No auth" },
  { v: "api_key", l: "API Key" },
  { v: "jwt", l: "JWT" },
  { v: "oauth2", l: "OAuth 2.0" },
  { v: "bearer", l: "Bearer Token" },
];

function ApiDevNew() {
  const nav = useNavigate();
  const createFn = useServerFn(createApiProject);
  const listFn = useServerFn(listMyApiProjects);
  const { data: mine = [] } = useQuery({ queryKey: ["my-api-projects"], queryFn: () => listFn() });

  const [form, setForm] = useState<any>({
    name: "", description: "", api_type: "REST", base_url: "", version: "v1", auth_type: "none",
  });
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  async function submit() {
    if (!form.name.trim()) { toast.error("Project name required"); return; }
    try {
      const row = await createFn({ data: form });
      toast.success("API project created");
      nav({ to: "/services/api-dev/$projectId", params: { projectId: (row as any).id } });
    } catch (e: any) { toast.error(e?.message || "Failed"); }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
      <div>
        <p className="text-xs font-mono tracking-[0.3em] text-primary">// API DEVELOPMENT PLATFORM</p>
        <h1 className="text-3xl font-bold neon-text flex items-center gap-2">
          <Code2 className="h-7 w-7" /> Build your API
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Design endpoints, test them, and generate documentation — with Spikes Bot at your side.</p>
      </div>

      {(mine as any[]).length > 0 && (
        <Card className="glass-card border-border/40">
          <CardHeader><CardTitle className="text-lg">Your projects</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border/40">
            {(mine as any[]).map((p) => (
              <Link key={p.id} to="/services/api-dev/$projectId" params={{ projectId: p.id }}
                className="py-3 flex items-center justify-between hover:bg-primary/5 px-2 rounded">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.api_type} · {p.auth_type} · {p.status}</div>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(p.updated_at).toLocaleDateString()}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="glass-card border-border/40">
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Plus className="h-5 w-5 text-primary" /> New API project</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div>
            <Label>API type</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {TYPES.map((t) => (
                <button key={t} onClick={() => set("api_type", t)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition ${form.api_type === t ? "border-primary text-primary bg-primary/10" : "border-border/40 text-muted-foreground hover:text-foreground"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Project name</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="My awesome API" />
            </div>
            <div>
              <Label>Version</Label>
              <Input value={form.version} onChange={(e) => set("version", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Base URL</Label>
              <Input value={form.base_url} onChange={(e) => set("base_url", e.target.value)} placeholder="https://api.example.com" />
            </div>
            <div>
              <Label>Authentication</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {AUTHS.map((a) => (
                  <button key={a.v} onClick={() => set("auth_type", a.v)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition ${form.auth_type === a.v ? "border-primary text-primary bg-primary/10" : "border-border/40 text-muted-foreground hover:text-foreground"}`}>
                    {a.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={submit} className="glow-purple">Create project →</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

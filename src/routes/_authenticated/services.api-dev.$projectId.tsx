import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Code2, Plus, Play, FileText, Trash2, ArrowLeft } from "lucide-react";
import {
  getApiProject, upsertEndpoint, deleteEndpoint, testEndpoint, generateApiDocs,
} from "@/lib/api-projects.functions";

export const Route = createFileRoute("/_authenticated/services/api-dev/$projectId")({
  head: () => ({ meta: [{ title: "API Workspace — Ghost Mods Tech" }] }),
  component: ApiWorkspace,
});

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

function ApiWorkspace() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getApiProject);
  const saveEp = useServerFn(upsertEndpoint);
  const delEp = useServerFn(deleteEndpoint);
  const testFn = useServerFn(testEndpoint);
  const docsFn = useServerFn(generateApiDocs);

  const { data } = useQuery({ queryKey: ["api-project", projectId], queryFn: () => getFn({ data: { id: projectId } }) });
  const project = data as any;
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ route: "/", method: "GET", description: "", request_body: {}, response_body: {}, headers: [] });
  const [testResult, setTestResult] = useState<any>(null);
  const [docs, setDocs] = useState<string>("");

  if (!project) return <div className="mx-auto max-w-5xl px-6 py-8 text-sm text-muted-foreground">Loading…</div>;

  function loadEndpoint(id: string) {
    const e = (project.endpoints || []).find((x: any) => x.id === id);
    if (!e) return;
    setSelected(id);
    setForm({
      route: e.route, method: e.method, description: e.description || "",
      request_body: e.request_body || {}, response_body: e.response_body || {}, headers: e.headers || [],
    });
    setTestResult(null);
  }

  async function saveEndpoint() {
    try {
      await saveEp({ data: {
        id: selected || undefined,
        data: {
          project_id: project.id,
          route: form.route, method: form.method, description: form.description,
          request_body: form.request_body, response_body: form.response_body, headers: form.headers,
          parameters: [], validation: {},
        }
      } });
      toast.success("Endpoint saved");
      qc.invalidateQueries({ queryKey: ["api-project", projectId] });
    } catch (e: any) { toast.error(e?.message || "Failed"); }
  }

  async function removeEndpoint(id: string) {
    if (!confirm("Delete endpoint?")) return;
    await delEp({ data: { id } });
    if (selected === id) setSelected(null);
    qc.invalidateQueries({ queryKey: ["api-project", projectId] });
  }

  async function runTest() {
    if (!selected) { toast.error("Save the endpoint first"); return; }
    try {
      const r = await testFn({ data: { projectId: project.id, endpointId: selected } });
      setTestResult(r);
    } catch (e: any) { toast.error(e?.message || "Failed"); }
  }

  async function makeDocs() {
    try {
      const r = await docsFn({ data: { projectId: project.id } });
      setDocs((r as any).markdown);
    } catch (e: any) { toast.error(e?.message || "Failed"); }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/services/api-dev/new" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Projects
          </Link>
          <h1 className="text-2xl font-bold neon-text flex items-center gap-2 mt-1">
            <Code2 className="h-6 w-6" /> {project.name}
          </h1>
          <p className="text-xs text-muted-foreground">{project.api_type} · {project.auth_type} · {project.version} · {project.base_url || "no base URL"}</p>
        </div>
        <Button onClick={makeDocs} variant="outline" className="gap-2"><FileText className="h-4 w-4" /> Generate Docs</Button>
      </div>

      <div className="grid grid-cols-[260px_1fr] gap-4">
        <Card className="glass-card border-border/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Endpoints</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => { setSelected(null); setForm({ route: "/new", method: "GET", description: "", request_body: {}, response_body: {}, headers: [] }); }}>
              <Plus className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-2">
            {(project.endpoints || []).length === 0 && <p className="text-xs text-muted-foreground px-2">No endpoints yet.</p>}
            {(project.endpoints || []).map((e: any) => (
              <div key={e.id} className={`flex items-center justify-between rounded px-2 py-1.5 text-xs ${selected === e.id ? "bg-primary/10 text-primary" : "hover:bg-primary/5"}`}>
                <button onClick={() => loadEndpoint(e.id)} className="flex-1 text-left truncate">
                  <span className="font-mono font-semibold mr-2">{e.method}</span>{e.route}
                </button>
                <button onClick={() => removeEndpoint(e.id)} className="text-destructive opacity-60 hover:opacity-100">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="glass-card border-border/40">
            <CardHeader><CardTitle className="text-sm">{selected ? "Edit endpoint" : "New endpoint"}</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid grid-cols-[110px_1fr] gap-2">
                <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  {METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
                <Input value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} placeholder="/users/:id" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <Label>Request body (JSON)</Label>
                <Textarea rows={4} value={JSON.stringify(form.request_body, null, 2)}
                  onChange={(e) => { try { setForm({ ...form, request_body: JSON.parse(e.target.value || "{}") }); } catch {} }} />
              </div>
              <div>
                <Label>Response example (JSON)</Label>
                <Textarea rows={4} value={JSON.stringify(form.response_body, null, 2)}
                  onChange={(e) => { try { setForm({ ...form, response_body: JSON.parse(e.target.value || "{}") }); } catch {} }} />
              </div>
              <div className="flex justify-end gap-2">
                <Button onClick={saveEndpoint} className="glow-purple">Save</Button>
                <Button onClick={runTest} variant="outline" className="gap-1"><Play className="h-4 w-4" /> Test</Button>
              </div>
            </CardContent>
          </Card>

          {testResult && (
            <Card className="glass-card border-border/40">
              <CardHeader><CardTitle className="text-sm">Test result</CardTitle></CardHeader>
              <CardContent>
                {testResult.ok ? (
                  <div className="text-xs space-y-2">
                    <div>Status: <span className="font-mono">{testResult.status} {testResult.statusText}</span> · {testResult.ms}ms</div>
                    <pre className="bg-background/50 border border-border/40 rounded p-2 overflow-x-auto whitespace-pre-wrap">{testResult.body}</pre>
                  </div>
                ) : (
                  <div className="text-xs text-destructive">Error: {testResult.error}</div>
                )}
              </CardContent>
            </Card>
          )}

          {docs && (
            <Card className="glass-card border-border/40">
              <CardHeader><CardTitle className="text-sm">Documentation</CardTitle></CardHeader>
              <CardContent>
                <pre className="text-xs bg-background/50 border border-border/40 rounded p-3 overflow-x-auto whitespace-pre-wrap">{docs}</pre>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

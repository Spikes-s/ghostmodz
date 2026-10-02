import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminDownloaderOverview,
  adminListJobs,
  adminJobAction,
  adminUpdatePlatform,
  adminUpdateDownloaderSettings,
  adminRunCleanup,
  adminRunDiagnostics,
} from "@/lib/downloader/admin-downloader.functions";
import { humanSize } from "@/lib/downloader/state";

export const Route = createFileRoute("/_authenticated/admin/downloader")({
  head: () => ({ meta: [{ title: "Downloader Admin — Ghost Mods Tech" }, { name: "robots", content: "noindex" }] }),
  component: AdminDownloader,
});

const TABS = ["Overview", "Jobs", "Platforms", "Rate limits", "Settings", "Audit logs", "Diagnostics"] as const;

function AdminDownloader() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const fn = useServerFn(adminDownloaderOverview);
  const ov = useQuery({ queryKey: ["admin-dl"], queryFn: () => fn() });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1 glass rounded-lg p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md text-sm ${tab === t ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>
      {ov.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {ov.error && <p className="text-sm text-destructive">{(ov.error as Error).message}</p>}
      {ov.data && tab === "Overview" && <Overview d={ov.data} />}
      {tab === "Jobs" && <Jobs />}
      {ov.data && tab === "Platforms" && <Platforms rows={ov.data.platforms} />}
      {ov.data && tab === "Rate limits" && <Limits rows={ov.data.rateLimits} />}
      {ov.data && tab === "Settings" && <SettingsForm s={ov.data.settings} />}
      {ov.data && tab === "Audit logs" && <Audits rows={ov.data.audits} />}
      {tab === "Diagnostics" && <Diagnostics />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="glass-card rounded-xl p-4">
      <p className="text-xs text-muted-foreground font-mono uppercase">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function Bars({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map((e) => e[1]));
  return (
    <div className="glass-card rounded-xl p-4">
      <h3 className="font-semibold mb-3">{title}</h3>
      {entries.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
      <div className="space-y-2">
        {entries.map(([k, v]) => (
          <div key={k} className="text-sm">
            <div className="flex justify-between"><span>{k}</span><span className="text-muted-foreground">{v}</span></div>
            <div className="h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-primary" style={{ width: `${(v / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Overview({ d }: { d: any }) {
  const qc = useQueryClient();
  const cleanup = useServerFn(adminRunCleanup);
  const save = useServerFn(adminUpdateDownloaderSettings);
  const run = useMutation({
    mutationFn: () => cleanup(),
    onSuccess: (r) => { toast.success(`Cleanup done: ${r.expiredJobs} job(s) expired, worker ${r.worker}.`); qc.invalidateQueries({ queryKey: ["admin-dl"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (patch: any) => save({ data: patch }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin-dl"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const t = d.totals;
  const s = d.settings ?? {};
  return (
    <div className="space-y-6">
      <div className="glass-card rounded-xl p-4 flex flex-wrap gap-2 items-center">
        <span className="text-sm font-semibold mr-2">Emergency controls:</span>
        <Button size="sm" variant={s.downloads_paused ? "default" : "outline"} onClick={() => toggle.mutate({ downloads_paused: !s.downloads_paused })}>
          {s.downloads_paused ? "Resume downloads" : "Pause new downloads"}
        </Button>
        <Button size="sm" variant={s.maintenance_mode ? "default" : "outline"} onClick={() => toggle.mutate({ maintenance_mode: !s.maintenance_mode })}>
          {s.maintenance_mode ? "Disable maintenance" : "Enable maintenance"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => run.mutate()} disabled={run.isPending}>
          <Trash2 className="h-4 w-4 mr-1" /> Run cleanup
        </Button>
        <Button size="sm" variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: ["admin-dl"] })}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
        <span className={`ml-auto text-xs font-mono ${d.workerConfigured ? "text-primary" : "text-destructive"}`}>
          WORKER: {d.workerConfigured ? "CONFIGURED" : "NOT CONFIGURED"}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="All-time jobs" value={t.allTime} />
        <Stat label="Today / 7 days" value={`${t.today} / ${t.week}`} />
        <Stat label="Successful (30d)" value={t.completed} />
        <Stat label="Failed (30d)" value={t.failed} />
        <Stat label="Active now" value={t.active} />
        <Stat label="Guest jobs (30d)" value={t.guest} />
        <Stat label="Avg processing" value={t.avgMs ? `${(t.avgMs / 1000).toFixed(1)}s` : "—"} />
        <Stat label="Success ratio" value={t.completed + t.failed ? `${Math.round((t.completed / (t.completed + t.failed)) * 100)}%` : "—"} />
      </div>
      <Bars title="Downloads per day (14 days)" data={d.perDay} />
      <div className="grid md:grid-cols-3 gap-4">
        <Bars title="Formats" data={d.byFormat} />
        <Bars title="Platforms" data={d.byPlatform} />
        <Bars title="Statuses" data={d.byStatus} />
      </div>
    </div>
  );
}

function Jobs() {
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const list = useServerFn(adminListJobs);
  const act = useServerFn(adminJobAction);
  const qc = useQueryClient();
  const jobs = useQuery({ queryKey: ["admin-dl-jobs", status, q, page], queryFn: () => list({ data: { status, q, page } }) });
  const m = useMutation({
    mutationFn: (v: { jobId: string; action: "cancel" | "expire" | "delete" | "sync" }) => act({ data: v }),
    onSuccess: () => { toast.success("Done"); qc.invalidateQueries({ queryKey: ["admin-dl-jobs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {["all", "queued", "processing", "converting", "completed", "failed", "expired", "cancelled"].map((s) => (
          <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => { setStatus(s); setPage(0); }}>{s}</Button>
        ))}
        <Input placeholder="Search URL, title, job or user ID" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} className="max-w-xs" aria-label="Search jobs" />
      </div>
      {jobs.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {jobs.data?.rows.length === 0 && <p className="text-sm text-muted-foreground">No jobs match.</p>}
      <div className="space-y-2">
        {jobs.data?.rows.map((j: any) => (
          <details key={j.id} className="glass-card rounded-lg p-3">
            <summary className="cursor-pointer flex flex-wrap gap-3 items-center text-sm">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted">{j.status}</span>
              <span className="font-medium truncate max-w-xs">{j.media_title || j.source_url}</span>
              <span className="text-muted-foreground">{j.source_platform} · {j.requested_format} {j.requested_quality}</span>
              <span className="text-muted-foreground ml-auto">{new Date(j.created_at).toLocaleString()}</span>
            </summary>
            <div className="mt-3 grid md:grid-cols-2 gap-1 text-xs text-muted-foreground break-all">
              <span>Job: {j.id}</span><span>User: {j.user_id ?? "guest"}</span>
              <span>URL: {j.source_url}</span><span>Size: {humanSize(j.output_size)}</span>
              <span>Attempts: {j.attempts}</span><span>Progress: {j.progress}%</span>
              <span>Started: {j.started_at ?? "—"}</span><span>Completed: {j.completed_at ?? "—"}</span>
              <span>Expires: {j.expires_at ?? "—"}</span>
              {j.error_code && <span className="text-destructive">Error: {j.error_code} — {j.error_message}</span>}
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => m.mutate({ jobId: j.id, action: "sync" })}>Sync</Button>
              <Button size="sm" variant="outline" onClick={() => m.mutate({ jobId: j.id, action: "cancel" })}>Cancel</Button>
              <Button size="sm" variant="outline" onClick={() => m.mutate({ jobId: j.id, action: "expire" })}>Expire file</Button>
              <Button size="sm" variant="destructive" onClick={() => confirm("Delete this job record?") && m.mutate({ jobId: j.id, action: "delete" })}>Delete</Button>
            </div>
          </details>
        ))}
      </div>
      <div className="flex gap-2 items-center text-sm">
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button>
        <span>Page {page + 1} of {Math.max(1, Math.ceil((jobs.data?.count ?? 0) / 25))}</span>
        <Button size="sm" variant="outline" disabled={(page + 1) * 25 >= (jobs.data?.count ?? 0)} onClick={() => setPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

function Platforms({ rows }: { rows: any[] }) {
  const upd = useServerFn(adminUpdatePlatform);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (v: any) => upd({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-dl"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {rows.map((p) => (
        <div key={p.id} className="glass-card rounded-lg p-4 flex items-center gap-3">
          <div className="flex-1">
            <p className="font-medium">{p.name}</p>
            <p className="text-xs text-muted-foreground">{p.domain} · {p.extractor} · status {p.status}</p>
          </div>
          <Button size="sm" variant={p.enabled ? "default" : "outline"} onClick={() => m.mutate({ id: p.id, enabled: !p.enabled })}>
            {p.enabled ? "Enabled" : "Disabled"}
          </Button>
        </div>
      ))}
    </div>
  );
}

function Limits({ rows }: { rows: any[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No requests counted yet.</p>;
  return (
    <div className="glass-card rounded-xl p-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground"><tr><th>Bucket</th><th>Window</th><th>Start</th><th>Count</th></tr></thead>
        <tbody>
          {rows.map((r: any, i: number) => (
            <tr key={i} className="border-t border-border/40">
              <td className="py-1 font-mono text-xs break-all">{r.bucket}</td><td>{r.scope}</td>
              <td>{new Date(r.window_start).toLocaleString()}</td><td>{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const NUM_FIELDS = [
  ["file_lifetime_minutes", "Temporary file lifetime (min)"],
  ["max_file_size_mb", "Max file size (MB)"],
  ["max_concurrent_jobs_per_user", "Concurrent jobs per user"],
  ["max_concurrent_jobs_global", "Concurrent jobs global"],
  ["guest_requests_per_hour", "Guest requests / hour"],
  ["user_requests_per_hour", "User requests / hour"],
  ["metadata_requests_per_minute", "Metadata requests / minute"],
  ["metadata_cache_minutes", "Metadata cache (min)"],
] as const;
const BOOL_FIELDS = [
  ["guest_downloads_enabled", "Guest downloads"],
  ["require_account", "Require account"],
  ["downloads_paused", "Downloads paused"],
  ["maintenance_mode", "Maintenance mode"],
] as const;
const TEXT_FIELDS = [
  ["site_name", "Site name"],
  ["support_email", "Support email"],
  ["terms_url", "Terms URL"],
  ["privacy_url", "Privacy URL"],
  ["footer_text", "Footer text"],
] as const;

function SettingsForm({ s }: { s: any }) {
  const [f, setF] = useState<any>(s ?? {});
  const save = useServerFn(adminUpdateDownloaderSettings);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => {
      const data: any = {};
      for (const [k] of TEXT_FIELDS) data[k] = k === "site_name" ? f[k] || "Ghost Mods Tech" : f[k] || null;
      for (const [k] of NUM_FIELDS) data[k] = Number(f[k]);
      for (const [k] of BOOL_FIELDS) data[k] = !!f[k];
      return save({ data });
    },
    onSuccess: () => { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["admin-dl"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <form className="glass-card rounded-xl p-5 space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
      <div className="grid md:grid-cols-2 gap-3">
        {TEXT_FIELDS.map(([k, l]) => (
          <label key={k} className="text-sm space-y-1"><span>{l}</span><Input value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
        ))}
        {NUM_FIELDS.map(([k, l]) => (
          <label key={k} className="text-sm space-y-1"><span>{l}</span><Input type="number" value={f[k] ?? 0} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        {BOOL_FIELDS.map(([k, l]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /> {l}
          </label>
        ))}
      </div>
      <Button type="submit" disabled={m.isPending}>Save settings</Button>
    </form>
  );
}

function Audits({ rows }: { rows: any[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No audit entries yet.</p>;
  return (
    <div className="space-y-2">
      {rows.map((a) => (
        <div key={a.id} className="glass-card rounded-lg p-3 text-sm flex flex-wrap gap-3">
          <span className="font-mono text-primary">{a.action}</span>
          <span className="text-muted-foreground break-all">{a.target ?? ""}</span>
          <span className="text-muted-foreground ml-auto">{new Date(a.created_at).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function Diagnostics() {
  const run = useServerFn(adminRunDiagnostics);
  const m = useMutation({ mutationFn: () => run(), onError: (e: Error) => toast.error(e.message) });
  const icon = (s: string) =>
    s === "pass" ? <CheckCircle2 className="h-5 w-5 text-primary" /> : s === "warning" ? <AlertTriangle className="h-5 w-5 text-secondary" /> : <XCircle className="h-5 w-5 text-destructive" />;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">Security &amp; System Diagnostics</h2>
        <Button onClick={() => m.mutate()} disabled={m.isPending} className="ml-auto gap-2">
          <Activity className="h-4 w-4" /> {m.isPending ? "Running…" : "Run full diagnostic"}
        </Button>
      </div>
      {!m.data && !m.isPending && <p className="text-sm text-muted-foreground">Press the button to run every check against the live system.</p>}
      {m.data && (
        <>
          <p className="text-xs text-muted-foreground">Ran at {new Date(m.data.ranAt).toLocaleString()}</p>
          <div className="space-y-2">
            {m.data.checks.map((c) => (
              <div key={c.id} className="glass-card rounded-lg p-3 flex gap-3 items-start">
                {icon(c.status)}
                <div className="flex-1">
                  <p className="font-medium">{c.label} <span className="text-xs font-mono uppercase ml-2">{c.status}</span></p>
                  <p className="text-sm text-muted-foreground">{c.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

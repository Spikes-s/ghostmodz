import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, RotateCcw, Trash2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteDownloadJob, getDownloadLink, listMyDownloads, retryDownloadJob } from "@/lib/downloader/downloader.functions";
import { humanSize, isActive } from "@/lib/downloader/state";

export const Route = createFileRoute("/_authenticated/downloader/history")({
  head: () => ({
    meta: [
      { title: "Download History — Ghost Mods Tech" },
      { name: "description", content: "Your recent media downloads, their status and available files." },
      { property: "og:title", content: "Download History — Ghost Mods Tech" },
      { property: "og:description", content: "Your recent media downloads and their status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

const FILTERS = ["all", "active", "completed", "failed"] as const;

function HistoryPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const qc = useQueryClient();
  const listFn = useServerFn(listMyDownloads);
  const linkFn = useServerFn(getDownloadLink);
  const retryFn = useServerFn(retryDownloadJob);
  const delFn = useServerFn(deleteDownloadJob);
  const { data, isLoading, error } = useQuery({
    queryKey: ["dl-history", filter],
    queryFn: () => listFn({ data: { status: filter, limit: 50 } }),
    staleTime: 0,
    refetchInterval: (q) => (q.state.data?.jobs.some((j) => isActive(j.status)) ? 4000 : false),
  });

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    try { await fn(); await qc.invalidateQueries({ queryKey: ["dl-history"] }); }
    catch (e: any) { toast.error(e?.message ?? "Action failed."); }
    finally { setBusy(null); }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div><p className="text-xs font-mono tracking-[0.3em] text-primary">// HISTORY</p><h1 className="text-3xl font-bold mt-1">Download history</h1></div>
        <Button asChild><Link to="/downloader"><Download className="h-4 w-4" /> New download</Link></Button>
      </div>
      <div className="flex gap-2 mb-5 overflow-x-auto" role="tablist">
        {FILTERS.map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm capitalize border ${filter === f ? "border-primary text-foreground" : "border-border/40 text-muted-foreground"}`}>{f}</button>
        ))}
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
        : error ? <p className="text-sm text-destructive">{(error as Error).message}</p>
        : !data?.jobs.length ? (
          <div className="glass-card rounded-2xl p-10 text-center"><History className="h-8 w-8 text-primary mx-auto mb-3" /><p className="text-muted-foreground">No downloads yet.</p></div>
        ) : (
          <ul className="space-y-3">
            {data.jobs.map((j) => (
              <li key={j.id} className="glass-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                {j.thumbnail && <img src={j.thumbnail} alt="" loading="lazy" className="w-full sm:w-28 aspect-video object-cover rounded" />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{j.media_title ?? j.source_url}</p>
                  <p className="text-xs text-muted-foreground">{j.source_platform ?? "—"} · {j.requested_format.toUpperCase()} {j.requested_quality ?? ""} · {humanSize(j.output_size)} · {new Date(j.created_at).toLocaleString()}</p>
                  <p className="text-xs mt-1"><span className="font-mono uppercase px-1.5 py-0.5 rounded border border-border/40">{j.status}</span>{j.error_message && <span className="text-muted-foreground ml-2">{j.error_message}</span>}</p>
                </div>
                <div className="flex gap-2">
                  {j.status === "completed" && <Button size="sm" disabled={busy === j.id} onClick={() => act(j.id, async () => { const r = await linkFn({ data: { id: j.id } }); window.location.assign(r.url); })} aria-label="Download file"><Download className="h-4 w-4" /></Button>}
                  {["failed", "cancelled"].includes(j.status) && j.attempts < j.max_attempts && <Button size="sm" variant="outline" disabled={busy === j.id} onClick={() => act(j.id, () => retryFn({ data: { id: j.id } }))} aria-label="Retry"><RotateCcw className="h-4 w-4" /></Button>}
                  <Button size="sm" variant="ghost" disabled={busy === j.id} onClick={() => act(j.id, () => delFn({ data: { id: j.id } }))} aria-label="Delete from history">{busy === j.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, CheckCircle2, ClipboardPaste, Download, Film, History, Loader2, Music, Image as ImageIcon, X, ShieldCheck, Zap, Lock, Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  analyzeMedia, cancelDownloadJob, createDownloadJob, getDownloadJob, getDownloadLink, getDownloaderConfig, type AnalyzeResult,
} from "@/lib/downloader/downloader.functions";
import { humanDuration, humanSize, isActive } from "@/lib/downloader/state";

export const Route = createFileRoute("/_authenticated/downloader/")({
  head: () => ({
    meta: [
      { title: "Ghost Mods Tech — Media Downloader" },
      { name: "description", content: "Ghost Mods Tech provides a fast, secure and modern media downloading experience for supported public media sources." },
      { property: "og:title", content: "Ghost Mods Tech — Media Downloader" },
      { property: "og:description", content: "Paste a supported media URL and retrieve the available video, audio and image formats." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DownloaderPage,
});

type Job = Awaited<ReturnType<typeof getDownloadJob>>;

const STAGES = ["queued", "analyzing", "processing", "converting", "completed"] as const;

function DownloaderPage() {
  const cfgFn = useServerFn(getDownloaderConfig);
  const analyzeFn = useServerFn(analyzeMedia);
  const createFn = useServerFn(createDownloadJob);
  const jobFn = useServerFn(getDownloadJob);
  const cancelFn = useServerFn(cancelDownloadJob);
  const linkFn = useServerFn(getDownloadLink);

  const { data: cfg } = useQuery({ queryKey: ["dl-config"], queryFn: () => cfgFn() });

  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [downloading, setDownloading] = useState(false);
  const idem = useRef<string>(crypto.randomUUID());

  // Poll the live job while it is active
  useEffect(() => {
    if (!job || !isActive(job.status)) return;
    const t = setInterval(async () => {
      try { setJob(await jobFn({ data: { id: job.id } })); } catch {}
    }, 2500);
    return () => clearInterval(t);
  }, [job?.id, job?.status]);

  async function analyze(e?: React.FormEvent) {
    e?.preventDefault();
    if (!url.trim() || analyzing) return;
    setAnalyzing(true); setError(null); setResult(null); setJob(null);
    try {
      setResult(await analyzeFn({ data: { url: url.trim() } }));
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.");
    } finally { setAnalyzing(false); }
  }

  async function start(format: string, quality: string) {
    if (!result || submitting) return;
    const key = `${format}:${quality}`;
    setSubmitting(key);
    try {
      const j = await createFn({ data: { url: result.url, format: format as any, quality: quality === "best" ? null : quality, idempotencyKey: idem.current } });
      idem.current = crypto.randomUUID();
      setJob(j);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not start the download.");
    } finally { setSubmitting(null); }
  }

  async function download() {
    if (!job) return;
    setDownloading(true);
    try {
      const { url: link } = await linkFn({ data: { id: job.id } });
      window.location.assign(link);
    } catch (err: any) { toast.error(err?.message ?? "Download link unavailable."); }
    finally { setDownloading(false); }
  }

  function reset() { setUrl(""); setResult(null); setJob(null); setError(null); }

  async function paste() {
    try { setUrl((await navigator.clipboard.readText()).trim()); } catch { toast.error("Clipboard access was blocked. Paste with Ctrl+V instead."); }
  }

  const blocked = cfg?.maintenance ? "GHOST MODS TECH IS CURRENTLY UNDER MAINTENANCE." : cfg?.paused ? "Downloads are temporarily paused by the administrator." : null;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12 sm:py-16">
      <section className="text-center mb-10">
        <p className="text-xs font-mono tracking-[0.3em] text-primary mb-3">GHOST MODS TECH</p>
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold mb-4">DOWNLOAD MEDIA. <span className="neon-text">SIMPLE. FAST. SECURE.</span></h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">Paste a supported media URL and retrieve the available video, audio and image formats.</p>
      </section>

      {cfg && !cfg.workerConfigured && (
        <div role="status" className="glass-card rounded-xl p-4 mb-6 flex gap-3 border border-secondary/40">
          <AlertTriangle className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
          <p className="text-sm">The media processing service has not been connected yet, so analysis and downloads are unavailable until an administrator finishes setup.</p>
        </div>
      )}
      {blocked && (
        <div role="alert" className="glass-card rounded-xl p-4 mb-6 flex gap-3 border border-destructive/40">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" /><p className="text-sm font-medium">{blocked}</p>
        </div>
      )}

      <form onSubmit={analyze} className="glass-card rounded-2xl p-3 sm:p-4 neon-border">
        <label htmlFor="media-url" className="sr-only">Media URL</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="media-url" type="url" inputMode="url" autoComplete="off" value={url} maxLength={2048}
            onChange={(e) => setUrl(e.target.value)} placeholder="Paste a video, audio or media URL..."
            className="flex-1 min-w-0 bg-background/40 rounded-lg px-4 py-3 text-base outline-none border border-border/40 focus-visible:ring-2 focus-visible:ring-primary"
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={url ? reset : paste} className="flex-1 sm:flex-none h-12">
              {url ? <><X className="h-4 w-4" /> Clear</> : <><ClipboardPaste className="h-4 w-4" /> Paste</>}
            </Button>
            <Button type="submit" disabled={!url.trim() || analyzing || !!blocked} className="flex-1 sm:flex-none h-12 px-6 font-semibold tracking-wider">
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : "ANALYZE"}
            </Button>
          </div>
        </div>
      </form>

      {cfg && cfg.platforms.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Supported sources">
          {cfg.platforms.filter((p) => p.domain !== "*").map((p) => (
            <span key={p.domain} className="text-[11px] font-mono px-2 py-1 rounded glass border border-border/40 text-muted-foreground">{p.name}</span>
          ))}
          {cfg.platforms.some((p) => p.domain === "*") && <span className="text-[11px] font-mono px-2 py-1 rounded glass border border-border/40 text-muted-foreground">Direct media links</span>}
        </div>
      )}

      <div className="mt-8" aria-live="polite">
        {analyzing && (
          <div className="glass-card rounded-2xl p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
            <p className="font-mono tracking-widest text-sm">ANALYZING MEDIA...</p>
          </div>
        )}

        {error && !analyzing && (
          <div role="alert" className="glass-card rounded-2xl p-6 border border-destructive/40">
            <div className="flex gap-3"><AlertTriangle className="h-5 w-5 text-destructive shrink-0" /><div><p className="font-semibold">Could not analyze this link</p><p className="text-sm text-muted-foreground mt-1">{error}</p></div></div>
            <div className="mt-4 flex gap-2"><Button size="sm" onClick={() => analyze()}>TRY AGAIN</Button><Button size="sm" variant="outline" onClick={reset}>ANOTHER URL</Button></div>
          </div>
        )}

        {result && !job && (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex flex-col sm:flex-row gap-4 p-5 border-b border-border/40">
              {result.metadata.thumbnail && <img src={result.metadata.thumbnail} alt="" loading="lazy" className="w-full sm:w-56 aspect-video object-cover rounded-lg" />}
              <div className="min-w-0">
                <h2 className="text-lg font-semibold break-words">{result.metadata.title ?? "Untitled media"}</h2>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <dt>Source</dt><dd className="text-foreground">{result.platform}</dd>
                  {result.metadata.uploader && <><dt>Uploader</dt><dd className="text-foreground truncate">{result.metadata.uploader}</dd></>}
                  <dt>Duration</dt><dd className="text-foreground">{humanDuration(result.metadata.duration)}</dd>
                  <dt>Type</dt><dd className="text-foreground capitalize">{result.metadata.mediaType ?? "—"}</dd>
                </dl>
              </div>
            </div>
            <div className="p-5 space-y-5">
              {result.outputs.map((o) => {
                const Icon = o.format === "image" ? ImageIcon : ["mp4", "webm"].includes(o.format) ? Film : Music;
                return (
                  <div key={o.format}>
                    <p className="text-xs font-mono tracking-widest text-primary mb-2 flex items-center gap-2"><Icon className="h-3.5 w-3.5" />{o.label.toUpperCase()}</p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {o.qualities.map((q) => {
                        const size = result.metadata.formats.find((f) => q.endsWith("p") && f.height === parseInt(q) && f.filesize)?.filesize;
                        return (
                          <div key={q} className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-background/30 px-3 py-2">
                            <div className="text-sm"><span className="font-semibold uppercase">{o.format}</span> <span className="text-muted-foreground">· {q}</span>{size ? <span className="text-muted-foreground"> · ~{humanSize(size)}</span> : null}</div>
                            <Button size="sm" disabled={!!submitting || !!blocked} onClick={() => start(o.format, q)} aria-label={`Download ${o.format} ${q}`}>
                              {submitting === `${o.format}:${q}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {job && <JobCard job={job} downloading={downloading} onDownload={download} onReset={reset}
          onCancel={async () => { try { setJob(await cancelFn({ data: { id: job.id } })); } catch (e: any) { toast.error(e.message); } }}
          onChangeFormat={() => setJob(null)} />}
      </div>

      <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["Paste URL", "Analyze", "Choose format", "Download"].map((s, i) => (
          <div key={s} className="glass-card rounded-xl p-5"><p className="text-xs font-mono text-primary">STEP {i + 1}</p><p className="font-semibold mt-1">{s}</p></div>
        ))}
      </section>
      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[[Zap, "Fast processing"], [Lock, "Secure temporary files"], [Radio, "Real-time status"], [ShieldCheck, "Privacy focused"]].map(([I, t]: any) => (
          <div key={t} className="glass-card rounded-xl p-5 flex items-center gap-3"><I className="h-5 w-5 text-primary" /><span className="text-sm">{t}</span></div>
        ))}
      </section>
      <p className="mt-10 text-xs text-muted-foreground text-center">
        Only download media you own or have permission to download. Protected, private or DRM content is never processed.
        {" "}<Link to="/downloader/history" className="text-primary inline-flex items-center gap-1"><History className="h-3 w-3" /> Your history</Link>
      </p>
    </div>
  );
}

function JobCard({ job, downloading, onDownload, onReset, onCancel, onChangeFormat }: { job: Job; downloading: boolean; onDownload: () => void; onReset: () => void; onCancel: () => void; onChangeFormat: () => void }) {
  if (job.status === "completed") {
    return (
      <div className="glass-card rounded-2xl p-6 neon-border">
        <p className="flex items-center gap-2 font-mono tracking-widest text-primary"><CheckCircle2 className="h-5 w-5" /> DOWNLOAD READY</p>
        <p className="mt-2 font-semibold break-words">{job.media_title ?? job.output_filename}</p>
        <p className="text-sm text-muted-foreground">{job.requested_format.toUpperCase()} · {job.requested_quality ?? "best"} · {humanSize(job.output_size)}</p>
        {job.expires_at && <p className="text-xs text-muted-foreground mt-1">Available until {new Date(job.expires_at).toLocaleTimeString()}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={onDownload} disabled={downloading}>{downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} DOWNLOAD FILE</Button>
          <Button variant="outline" onClick={onReset}>DOWNLOAD ANOTHER</Button>
        </div>
      </div>
    );
  }
  if (["failed", "cancelled", "expired"].includes(job.status)) {
    return (
      <div role="alert" className="glass-card rounded-2xl p-6 border border-destructive/40">
        <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-5 w-5 text-destructive" /> {job.status === "cancelled" ? "DOWNLOAD CANCELLED" : job.status === "expired" ? "FILE EXPIRED" : "DOWNLOAD FAILED"}</p>
        {job.error_message && <p className="text-sm text-muted-foreground mt-2">{job.error_message}</p>}
        <div className="mt-4 flex flex-wrap gap-2"><Button onClick={onChangeFormat}>CHANGE FORMAT</Button><Button variant="outline" onClick={onReset}>DOWNLOAD ANOTHER URL</Button></div>
      </div>
    );
  }
  const idx = STAGES.indexOf(job.status as any);
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono tracking-widest text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-primary" /> {job.status.toUpperCase()}…</p>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
      <ol className="mt-4 grid grid-cols-5 gap-1 text-[10px] font-mono">
        {STAGES.map((s, i) => (
          <li key={s} className={`pt-2 border-t-2 ${i <= idx ? "border-primary text-foreground" : "border-border/40 text-muted-foreground"}`}>{s === "completed" ? "READY" : s.toUpperCase()}</li>
        ))}
      </ol>
      {job.progress > 1 ? (
        <div className="mt-4 h-2 rounded bg-muted overflow-hidden" role="progressbar" aria-valuenow={job.progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-primary transition-all" style={{ width: `${job.progress}%` }} />
        </div>
      ) : (
        <div className="mt-4 h-2 rounded bg-muted overflow-hidden"><div className="h-full w-1/3 bg-primary animate-pulse" /></div>
      )}
    </div>
  );
}

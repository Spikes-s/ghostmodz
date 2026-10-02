import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { admin, audit, syncJob } from "./core.server";
import { workerClient, isWorkerConfigured } from "./worker-client.server";
import { checkMediaUrl } from "./url";
import { isActive } from "./state";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "administrator")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: administrator required");
}

const DAY = 86400000;

export const adminDownloaderOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = await admin();
    const since30 = new Date(Date.now() - 30 * DAY).toISOString();
    const [jobsRes, total, settings, platforms, audits, limits] = await Promise.all([
      db
        .from("download_jobs")
        .select("status, requested_format, source_platform, created_at, started_at, completed_at, user_id, output_size")
        .gte("created_at", since30)
        .limit(5000),
      db.from("download_jobs").select("id", { count: "exact", head: true }),
      db.from("downloader_settings").select("*").eq("id", 1).maybeSingle(),
      db.from("platforms").select("*").order("name"),
      db.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50),
      db.from("rate_limits").select("*").order("window_start", { ascending: false }).limit(50),
    ]);
    const jobs: any[] = jobsRes.data ?? [];
    const by = (k: string) =>
      jobs.reduce<Record<string, number>>((a, j) => {
        const v = j[k] ?? "unknown";
        a[v] = (a[v] ?? 0) + 1;
        return a;
      }, {});
    const durations = jobs
      .filter((j) => j.status === "completed" && j.started_at && j.completed_at)
      .map((j) => new Date(j.completed_at).getTime() - new Date(j.started_at).getTime());
    const perDay: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) perDay[new Date(Date.now() - i * DAY).toISOString().slice(0, 10)] = 0;
    for (const j of jobs) {
      const d = j.created_at.slice(0, 10);
      if (d in perDay) perDay[d]++;
    }
    const now = Date.now();
    const countSince = (ms: number) => jobs.filter((j) => now - new Date(j.created_at).getTime() < ms).length;
    return {
      totals: {
        allTime: total.count ?? 0,
        last30: jobs.length,
        completed: jobs.filter((j) => j.status === "completed" || j.status === "expired").length,
        failed: jobs.filter((j) => j.status === "failed").length,
        active: jobs.filter((j) => isActive(j.status)).length,
        guest: jobs.filter((j) => !j.user_id).length,
        today: countSince(DAY),
        week: countSince(7 * DAY),
        avgMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
      },
      byStatus: by("status"),
      byFormat: by("requested_format"),
      byPlatform: by("source_platform"),
      perDay,
      settings: settings.data,
      platforms: platforms.data ?? [],
      audits: audits.data ?? [],
      rateLimits: limits.data ?? [],
      workerConfigured: isWorkerConfigured(),
    };
  });

export const adminListJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        status: z.string().max(20).default("all"),
        q: z.string().max(300).default(""),
        page: z.number().int().min(0).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    let q = db
      .from("download_jobs")
      .select(
        "id, user_id, source_url, source_platform, media_title, media_type, requested_format, requested_quality, status, progress, error_code, error_message, output_filename, output_size, attempts, created_at, started_at, completed_at, expires_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(data.page * 25, data.page * 25 + 24);
    if (data.status !== "all") q = q.eq("status", data.status);
    const s = data.q.trim().replace(/[%,()]/g, "");
    if (s) {
      if (/^[0-9a-f-]{36}$/i.test(s)) q = q.or(`id.eq.${s},user_id.eq.${s}`);
      else q = q.or(`source_url.ilike.%${s}%,media_title.ilike.%${s}%`);
    }
    const { data: rows, count, error } = await q;
    if (error) throw new Error("Could not load jobs.");
    return { rows: rows ?? [], count: count ?? 0 };
  });

export const adminJobAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ jobId: z.string().uuid(), action: z.enum(["cancel", "expire", "delete", "sync"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: job } = await db.from("download_jobs").select("*").eq("id", data.jobId).maybeSingle();
    if (!job) throw new Error("Job not found.");
    if (data.action === "sync") {
      await syncJob(job);
    } else if (data.action === "cancel") {
      if (!isActive(job.status)) throw new Error("Only active jobs can be cancelled.");
      if (job.worker_job_id) await workerClient.cancel(job.worker_job_id).catch(() => {});
      await db.from("download_jobs").update({ status: "cancelled", completed_at: new Date().toISOString() }).eq("id", job.id);
    } else if (data.action === "expire") {
      if (job.status !== "completed") throw new Error("Only completed jobs can be expired.");
      await db.from("download_jobs").update({ status: "expired", expires_at: new Date().toISOString() }).eq("id", job.id);
      await workerClient.cleanup().catch(() => {});
    } else {
      if (isActive(job.status) && job.worker_job_id) await workerClient.cancel(job.worker_job_id).catch(() => {});
      await db.from("analytics_events").update({ job_id: null }).eq("job_id", job.id);
      await db.from("download_jobs").delete().eq("id", job.id);
    }
    await audit({ actorId: context.userId, action: `admin.job.${data.action}`, target: job.id });
    return { ok: true };
  });

export const adminUpdatePlatform = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        enabled: z.boolean().optional(),
        name: z.string().min(1).max(80).optional(),
        notes: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { id, ...patch } = data;
    const { error } = await db.from("platforms").update(patch).eq("id", id);
    if (error) throw new Error("Could not update platform.");
    await audit({ actorId: context.userId, action: "admin.platform.update", target: id, metadata: patch });
    return { ok: true };
  });

const settingsSchema = z.object({
  site_name: z.string().min(1).max(80),
  support_email: z.string().max(200).nullable(),
  terms_url: z.string().max(300).nullable(),
  privacy_url: z.string().max(300).nullable(),
  footer_text: z.string().max(300).nullable(),
  guest_downloads_enabled: z.boolean(),
  require_account: z.boolean(),
  downloads_paused: z.boolean(),
  maintenance_mode: z.boolean(),
  file_lifetime_minutes: z.number().int().min(5).max(1440),
  max_file_size_mb: z.number().int().min(1).max(10240),
  max_concurrent_jobs_per_user: z.number().int().min(1).max(20),
  max_concurrent_jobs_global: z.number().int().min(1).max(500),
  guest_requests_per_hour: z.number().int().min(0).max(10000),
  user_requests_per_hour: z.number().int().min(1).max(10000),
  metadata_requests_per_minute: z.number().int().min(1).max(1000),
  metadata_cache_minutes: z.number().int().min(0).max(1440),
});

export const adminUpdateDownloaderSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settingsSchema.partial().parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { error } = await db.from("downloader_settings").update(data).eq("id", 1);
    if (error) throw new Error("Could not save settings.");
    await audit({ actorId: context.userId, action: "admin.settings.update", target: "downloader_settings", metadata: data });
    return { ok: true };
  });

export const adminRunCleanup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = await admin();
    const nowIso = new Date().toISOString();
    const { data: expired } = await db
      .from("download_jobs")
      .update({ status: "expired" })
      .eq("status", "completed")
      .lt("expires_at", nowIso)
      .select("id");
    await db.from("media_metadata_cache").delete().lt("expires_at", nowIso);
    let worker: string = "not configured";
    if (isWorkerConfigured()) {
      try {
        const r: any = await workerClient.cleanup();
        worker = `removed ${r?.deleted ?? 0} file(s)`;
      } catch {
        worker = "unreachable";
      }
    }
    await audit({ actorId: context.userId, action: "admin.cleanup.run", metadata: { expired: expired?.length ?? 0, worker } });
    return { expiredJobs: expired?.length ?? 0, worker };
  });

type Check = { id: string; label: string; status: "pass" | "warning" | "fail"; detail: string };

export const adminRunDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = await admin();
    const checks: Check[] = [];
    const add = (c: Check) => checks.push(c);

    const t0 = Date.now();
    const ping = await db.from("downloader_settings").select("id").eq("id", 1).maybeSingle();
    add({
      id: "db",
      label: "Database connectivity",
      status: ping.error ? "fail" : "pass",
      detail: ping.error ? "Database query failed." : `Responded in ${Date.now() - t0} ms.`,
    });

    // Anonymous access probes against sensitive tables (RLS)
    const url = process.env.SUPABASE_URL;
    const anon = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (url && anon) {
      const sensitive = ["download_jobs", "downloader_settings", "rate_limits", "audit_logs", "worker_heartbeats", "media_metadata_cache"];
      const leaks: string[] = [];
      for (const t of sensitive) {
        try {
          const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=1`, { headers: { apikey: anon } });
          if (r.ok) {
            const rows = await r.json();
            if (Array.isArray(rows) && rows.length) leaks.push(t);
          }
        } catch {
          /* network error is not a leak */
        }
      }
      add({
        id: "rls",
        label: "Row-level security (anonymous access)",
        status: leaks.length ? "fail" : "pass",
        detail: leaks.length ? `Anonymous visitors can read: ${leaks.join(", ")}.` : "Sensitive tables are not readable anonymously.",
      });
    } else {
      add({ id: "rls", label: "Row-level security", status: "warning", detail: "Backend URL/key env vars missing; probe skipped." });
    }

    // SSRF guard self-test
    const bad = ["http://127.0.0.1/x", "http://169.254.169.254/latest", "http://localhost:8080", "http://10.0.0.5/a", "http://[::1]/"];
    const leaked = bad.filter((u) => checkMediaUrl(u).ok);
    add({
      id: "ssrf",
      label: "SSRF protection",
      status: leaked.length ? "fail" : "pass",
      detail: leaked.length ? `Not blocked: ${leaked.join(", ")}` : "Private, loopback and metadata addresses are rejected.",
    });

    // Env vars
    const missing = ["WORKER_API_URL", "WORKER_API_SECRET"].filter((k) => !process.env[k]);
    add({
      id: "env",
      label: "Worker configuration",
      status: missing.length ? "fail" : "pass",
      detail: missing.length
        ? `Missing secrets: ${missing.join(", ")}. Deploy the worker (see DEPLOYMENT.md) and save them.`
        : "Worker address and key are configured.",
    });

    // Worker health
    const h = await workerClient.health().catch(() => null);
    add({
      id: "worker",
      label: "Worker connectivity",
      status: !h?.configured ? "fail" : h.online ? "pass" : "fail",
      detail: !h?.configured
        ? "Worker not configured."
        : h.online
          ? `Online, ${h.latencyMs ?? "?"} ms, ${h.activeJobs ?? 0} active job(s).`
          : `Offline: ${h.error ?? "no response"}.`,
    });
    add({
      id: "ytdlp",
      label: "yt-dlp availability",
      status: h?.online && h.ytdlp ? "pass" : "fail",
      detail: h?.online && h.ytdlp ? `Version ${h.ytdlp}.` : "Unknown — worker not reachable.",
    });
    add({
      id: "ffmpeg",
      label: "FFmpeg availability",
      status: h?.online && h.ffmpeg ? "pass" : h?.online ? "warning" : "fail",
      detail: h?.online ? (h.ffmpeg ? `Version ${h.ffmpeg}.` : "Not found — audio conversion disabled.") : "Unknown — worker not reachable.",
    });

    // Heartbeat
    const hb = await db.from("worker_heartbeats").select("*").order("reported_at", { ascending: false }).limit(1).maybeSingle();
    if (h?.online) {
      await db.from("worker_heartbeats").insert({
        worker_id: "primary",
        version: h.version ?? null,
        active_jobs: h.activeJobs ?? 0,
        queue_length: h.queueLength ?? 0,
        cpu_percent: h.cpuPercent ?? null,
        memory_percent: h.memoryPercent ?? null,
        capabilities: { ytdlp: h.ytdlp, ffmpeg: h.ffmpeg },
      }).then(() => null, () => null);
    }
    add({
      id: "heartbeat",
      label: "Worker heartbeat",
      status: h?.online ? "pass" : hb.data ? "warning" : "fail",
      detail: h?.online ? "Heartbeat recorded now." : hb.data ? `Last seen ${hb.data.reported_at}.` : "No heartbeat ever recorded.",
    });

    // Stuck jobs
    const stuckSince = new Date(Date.now() - 30 * 60000).toISOString();
    const stuck = await db
      .from("download_jobs")
      .select("id", { count: "exact", head: true })
      .in("status", ["queued", "analyzing", "processing", "converting"])
      .lt("created_at", stuckSince);
    add({
      id: "queue",
      label: "Queue health",
      status: (stuck.count ?? 0) > 0 ? "warning" : "pass",
      detail: (stuck.count ?? 0) > 0 ? `${stuck.count} job(s) active for over 30 minutes — open Jobs and sync them.` : "No stuck jobs.",
    });

    // Expired files pending cleanup
    const exp = await db
      .from("download_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .lt("expires_at", new Date().toISOString());
    add({
      id: "expired",
      label: "Expired files",
      status: (exp.count ?? 0) > 0 ? "warning" : "pass",
      detail: (exp.count ?? 0) > 0 ? `${exp.count} expired file(s) awaiting cleanup — press Run cleanup.` : "Nothing waiting for cleanup.",
    });

    // Failure rate (24h)
    const since = new Date(Date.now() - DAY).toISOString();
    const recent = await db.from("download_jobs").select("status").gte("created_at", since);
    const r = recent.data ?? [];
    const failed = r.filter((x: any) => x.status === "failed").length;
    add({
      id: "failures",
      label: "Failed jobs (24h)",
      status: r.length && failed / r.length > 0.5 ? "warning" : "pass",
      detail: `${failed} of ${r.length} job(s) failed.`,
    });

    // Rate limiting RPC
    const rl = await db.rpc("hit_rate_limit", {
      _bucket: "diagnostic",
      _scope: "minute",
      _window_start: new Date(Math.floor(Date.now() / 60000) * 60000).toISOString(),
    });
    add({
      id: "ratelimit",
      label: "Rate limiting",
      status: rl.error ? "fail" : "pass",
      detail: rl.error ? "Rate-limit counter is not working." : "Atomic request counter responds.",
    });

    const s = ping.data ? (await db.from("downloader_settings").select("maintenance_mode, downloads_paused").eq("id", 1).single()).data : null;
    add({
      id: "mode",
      label: "Service mode",
      status: s?.maintenance_mode || s?.downloads_paused ? "warning" : "pass",
      detail: s?.maintenance_mode ? "Maintenance mode is ON." : s?.downloads_paused ? "New downloads are paused." : "Accepting downloads.",
    });

    await audit({ actorId: context.userId, action: "admin.diagnostics.run", metadata: { fails: checks.filter((c) => c.status === "fail").length } });
    return { checks, ranAt: new Date().toISOString() };
  });

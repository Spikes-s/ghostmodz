import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { OUTPUT_FORMATS, isActive, safeErrorMessage } from "./state";
import {
  admin,
  audit,
  assertServiceOpen,
  DlError,
  enforceRateLimit,
  getSettings,
  publicJob,
  resolveMediaUrl,
  syncJob,
  track,
} from "./core.server";
import { workerClient, WorkerError, type WorkerMetadata } from "./worker-client.server";

function fail(err: unknown): never {
  if (err instanceof DlError) throw new Error(err.message);
  if (err instanceof WorkerError) throw new Error(safeErrorMessage(err.code));
  console.error(JSON.stringify({ scope: "downloader", error: String((err as any)?.message ?? err) }));
  throw new Error(safeErrorMessage("unknown"));
}

/* ---------------- Public config + worker status ---------------- */

export const getDownloaderConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const s = await getSettings();
      const db = await admin();
      const { data: platforms } = await db
        .from("platforms")
        .select("name, domain, status, notes")
        .eq("enabled", true)
        .order("name");
      return {
        siteName: s.site_name,
        maintenance: s.maintenance_mode,
        paused: s.downloads_paused,
        fileLifetimeMinutes: s.file_lifetime_minutes,
        maxFileSizeMb: s.max_file_size_mb,
        maxConcurrent: s.max_concurrent_jobs_per_user,
        requestsPerHour: s.user_requests_per_hour,
        termsUrl: s.terms_url,
        privacyUrl: s.privacy_url,
        workerConfigured: workerClient.configured(),
        platforms: (platforms ?? []) as { name: string; domain: string; status: string; notes: string | null }[],
      };
    } catch (e) {
      fail(e);
    }
  });

export const getWorkerStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const h = await workerClient.health();
    return { configured: h.configured, online: h.online, error: h.error ?? null };
  });

/* ---------------- Analyze ---------------- */

const AnalyzeInput = z.object({ url: z.string().min(1).max(2048) });

export type AnalyzeResult = {
  url: string;
  platform: string;
  cached: boolean;
  metadata: WorkerMetadata;
  outputs: { format: (typeof OUTPUT_FORMATS)[number]; label: string; qualities: string[] }[];
};

function buildOutputs(meta: WorkerMetadata): AnalyzeResult["outputs"] {
  const video = meta.formats.filter((f) => f.kind === "video");
  const audio = meta.formats.filter((f) => f.kind === "audio");
  const heights = [...new Set(video.map((f) => f.height).filter((h): h is number => !!h))].sort((a, b) => b - a);
  const out: AnalyzeResult["outputs"] = [];
  if (video.length) {
    out.push({ format: "mp4", label: "MP4 video", qualities: heights.length ? heights.map((h) => `${h}p`) : ["best"] });
    if (video.some((f) => f.container === "webm")) {
      const wh = [...new Set(video.filter((f) => f.container === "webm").map((f) => f.height).filter((h): h is number => !!h))].sort((a, b) => b - a);
      out.push({ format: "webm", label: "WebM video", qualities: wh.length ? wh.map((h) => `${h}p`) : ["best"] });
    }
  }
  if (audio.length || video.length) {
    out.push({ format: "mp3", label: "MP3 audio", qualities: ["320k", "192k", "128k"] });
    out.push({ format: "m4a", label: "M4A audio", qualities: ["best"] });
    out.push({ format: "wav", label: "WAV audio (lossless)", qualities: ["best"] });
  }
  if (meta.thumbnail || meta.formats.some((f) => f.kind === "image")) {
    out.push({ format: "image", label: "Image / thumbnail", qualities: ["best"] });
  }
  return out;
}

export const analyzeMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AnalyzeInput.parse(d))
  .handler(async ({ data, context }): Promise<AnalyzeResult> => {
    try {
      const settings = await getSettings();
      await assertServiceOpen(settings);
      const resolved = await resolveMediaUrl(data.url);
      await enforceRateLimit(`user:${context.userId}`, "metadata", "minute", settings.metadata_requests_per_minute);

      const db = await admin();
      const { data: cached } = await db
        .from("media_metadata_cache")
        .select("payload, expires_at")
        .eq("url_hash", resolved.urlHash)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      let meta: WorkerMetadata;
      let fromCache = false;
      if (cached?.payload) {
        meta = cached.payload as WorkerMetadata;
        fromCache = true;
      } else {
        const started = Date.now();
        meta = await workerClient.analyze(resolved.normalized);
        if (!meta || !Array.isArray(meta.formats)) throw new DlError("extraction_failed");
        await db.from("media_metadata_cache").upsert({
          url_hash: resolved.urlHash,
          normalized_url: resolved.normalized,
          platform: resolved.platform.name,
          payload: meta,
          expires_at: new Date(Date.now() + settings.metadata_cache_minutes * 60_000).toISOString(),
        });
        await track({
          event: "media_analyzed",
          userId: context.userId,
          platform: resolved.platform.name,
          durationMs: Date.now() - started,
          metadata: { formats: meta.formats.length },
        });
      }
      const outputs = buildOutputs(meta);
      if (!outputs.length) throw new DlError("media_unavailable");
      return { url: resolved.normalized, platform: resolved.platform.name, cached: fromCache, metadata: meta, outputs };
    } catch (e) {
      if (e instanceof DlError || e instanceof WorkerError) {
        await track({ event: "analyze_failed", userId: context.userId, status: "failed", metadata: { code: (e as any).code } });
      }
      fail(e);
    }
  });

/* ---------------- Create job ---------------- */

const CreateInput = z.object({
  url: z.string().min(1).max(2048),
  format: z.enum(OUTPUT_FORMATS),
  quality: z.string().max(16).regex(/^[a-z0-9]+$/i).nullable().optional(),
  formatId: z.string().max(64).regex(/^[A-Za-z0-9_\-+.]+$/).nullable().optional(),
  idempotencyKey: z.string().uuid().optional(),
});

export const createDownloadJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    try {
      const db = await admin();
      if (data.idempotencyKey) {
        const { data: existing } = await db
          .from("download_jobs")
          .select("*")
          .eq("idempotency_key", data.idempotencyKey)
          .eq("user_id", context.userId)
          .maybeSingle();
        if (existing) return publicJob(existing);
      }

      const settings = await getSettings();
      await assertServiceOpen(settings);
      if (!workerClient.configured()) throw new DlError("worker_unconfigured");
      const resolved = await resolveMediaUrl(data.url);
      await enforceRateLimit(`user:${context.userId}`, "job", "hour", settings.user_requests_per_hour);

      const activeStatuses = ["queued", "analyzing", "processing", "converting"];
      const [{ count: mine }, { count: global }] = await Promise.all([
        db.from("download_jobs").select("id", { count: "exact", head: true }).eq("user_id", context.userId).in("status", activeStatuses),
        db.from("download_jobs").select("id", { count: "exact", head: true }).in("status", activeStatuses),
      ]);
      if ((mine ?? 0) >= settings.max_concurrent_jobs_per_user) throw new DlError("concurrency_limit");
      if ((global ?? 0) >= settings.max_concurrent_jobs_global)
        throw new DlError("concurrency_limit", "The service is busy right now. Please try again in a few minutes.");

      const { data: cached } = await db
        .from("media_metadata_cache")
        .select("payload")
        .eq("url_hash", resolved.urlHash)
        .maybeSingle();
      const meta = (cached?.payload ?? null) as WorkerMetadata | null;

      const { data: job, error } = await db
        .from("download_jobs")
        .insert({
          user_id: context.userId,
          source_url: data.url.slice(0, 2048),
          normalized_url: resolved.normalized,
          url_hash: resolved.urlHash,
          source_platform: resolved.platform.name,
          media_title: meta?.title ?? null,
          media_type: data.format === "image" ? "image" : ["mp3", "wav", "m4a"].includes(data.format) ? "audio" : "video",
          requested_format: data.format,
          requested_quality: data.quality ?? null,
          status: "queued",
          attempts: 1,
          idempotency_key: data.idempotencyKey ?? null,
          metadata: {
            thumbnail: meta?.thumbnail ?? null,
            duration: meta?.duration ?? null,
            uploader: meta?.uploader ?? null,
            format_id: data.formatId ?? null,
          },
        })
        .select("*")
        .single();
      if (error || !job) throw new DlError("database_failure");

      await track({ event: "download_requested", userId: context.userId, jobId: job.id, platform: resolved.platform.name, format: data.format });
      await audit({ actorId: context.userId, action: "download.requested", target: job.id, metadata: { platform: resolved.platform.name, format: data.format, quality: data.quality ?? null } });

      return publicJob(await dispatch(job, settings, data.formatId ?? null));
    } catch (e) {
      fail(e);
    }
  });

async function dispatch(job: any, settings: Awaited<ReturnType<typeof getSettings>>, formatId: string | null) {
  const db = await admin();
  try {
    const res = await workerClient.createJob({
      jobId: job.id,
      url: job.normalized_url,
      format: job.requested_format,
      quality: job.requested_quality,
      formatId,
      maxSizeMb: settings.max_file_size_mb,
      ttlMinutes: settings.file_lifetime_minutes,
    });
    const { data } = await db
      .from("download_jobs")
      .update({ worker_job_id: res.workerJobId, status: "processing", started_at: new Date().toISOString(), progress: 1 })
      .eq("id", job.id)
      .select("*")
      .single();
    return data ?? job;
  } catch (err) {
    const code = err instanceof WorkerError ? err.code : "worker_unavailable";
    const { data } = await db
      .from("download_jobs")
      .update({ status: "failed", error_code: code, error_message: safeErrorMessage(code) })
      .eq("id", job.id)
      .select("*")
      .single();
    await track({ event: "download_failed", userId: job.user_id, jobId: job.id, platform: job.source_platform, format: job.requested_format, status: "failed", metadata: { error_code: code, stage: "dispatch" } });
    return data ?? job;
  }
}

/* ---------------- Read / poll ---------------- */

async function ownJob(userId: string, id: string) {
  const db = await admin();
  const { data } = await db.from("download_jobs").select("*").eq("id", id).maybeSingle();
  if (!data || data.user_id !== userId) throw new DlError("forbidden", "Download not found.");
  return data;
}

const IdInput = z.object({ id: z.string().uuid() });

export const getDownloadJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    try {
      const job = await ownJob(context.userId, data.id);
      return publicJob(await syncJob(job));
    } catch (e) {
      fail(e);
    }
  });

const ListInput = z.object({
  status: z.enum(["all", "active", "completed", "failed"]).default("all"),
  limit: z.number().int().min(1).max(100).default(50),
});

export const listMyDownloads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    try {
      const db = await admin();
      let q = db.from("download_jobs").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(data.limit);
      if (data.status === "active") q = q.in("status", ["queued", "analyzing", "processing", "converting"]);
      if (data.status === "completed") q = q.in("status", ["completed", "expired"]);
      if (data.status === "failed") q = q.in("status", ["failed", "cancelled"]);
      const { data: rows, error } = await q;
      if (error) throw new DlError("database_failure");
      const synced = await Promise.all(
        (rows ?? []).map((j: any) =>
          isActive(j.status) || (j.status === "completed" && j.expires_at) ? syncJob(j).catch(() => j) : j,
        ),
      );
      const all = synced.map(publicJob);
      return {
        jobs: all,
        stats: {
          total: all.length,
          active: all.filter((j) => isActive(j.status)).length,
          completed: all.filter((j) => j.status === "completed").length,
          failed: all.filter((j) => j.status === "failed").length,
        },
      };
    } catch (e) {
      fail(e);
    }
  });

/* ---------------- Actions ---------------- */

export const cancelDownloadJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    try {
      const job = await ownJob(context.userId, data.id);
      if (!isActive(job.status)) throw new DlError("forbidden", "Only active downloads can be cancelled.");
      if (job.worker_job_id) await workerClient.cancelJob(job.worker_job_id).catch(() => null);
      const db = await admin();
      const { data: updated } = await db.from("download_jobs").update({ status: "cancelled" }).eq("id", job.id).select("*").single();
      await audit({ actorId: context.userId, action: "download.cancelled", target: job.id });
      return publicJob(updated ?? job);
    } catch (e) {
      fail(e);
    }
  });

export const retryDownloadJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    try {
      const job = await ownJob(context.userId, data.id);
      if (!["failed", "cancelled"].includes(job.status)) throw new DlError("forbidden", "Only failed or cancelled downloads can be retried.");
      if (job.attempts >= job.max_attempts) throw new DlError("max_attempts");
      const settings = await getSettings();
      await assertServiceOpen(settings);
      if (!workerClient.configured()) throw new DlError("worker_unconfigured");
      await enforceRateLimit(`user:${context.userId}`, "job", "hour", settings.user_requests_per_hour);
      const db = await admin();
      const { data: queued, error } = await db
        .from("download_jobs")
        .update({ status: "queued", attempts: job.attempts + 1, progress: 0, error_code: null, error_message: null, worker_job_id: null })
        .eq("id", job.id)
        .select("*")
        .single();
      if (error || !queued) throw new DlError("database_failure");
      await audit({ actorId: context.userId, action: "download.retried", target: job.id, metadata: { attempt: job.attempts + 1 } });
      return publicJob(await dispatch(queued, settings, (job.metadata?.format_id as string) ?? null));
    } catch (e) {
      fail(e);
    }
  });

export const getDownloadLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    try {
      const job = await syncJob(await ownJob(context.userId, data.id));
      if (job.status === "expired") throw new DlError("file_expired");
      if (job.status !== "completed" || !job.worker_job_id) throw new DlError("forbidden", "This download is not ready yet.");
      const link = await workerClient.downloadUrl(job.worker_job_id);
      if (!link?.url || !/^https:\/\//i.test(link.url)) throw new DlError("storage_failure");
      await audit({ actorId: context.userId, action: "download.file_served", target: job.id });
      await track({ event: "file_downloaded", userId: context.userId, jobId: job.id, platform: job.source_platform, format: job.requested_format });
      return { url: link.url, filename: job.output_filename as string | null };
    } catch (e) {
      fail(e);
    }
  });

export const deleteDownloadJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    try {
      const job = await ownJob(context.userId, data.id);
      if (isActive(job.status) && job.worker_job_id) await workerClient.cancelJob(job.worker_job_id).catch(() => null);
      const db = await admin();
      await db.from("analytics_events").update({ job_id: null }).eq("job_id", job.id);
      const { error } = await db.from("download_jobs").delete().eq("id", job.id).eq("user_id", context.userId);
      if (error) throw new DlError("database_failure");
      await audit({ actorId: context.userId, action: "download.deleted", target: job.id });
      return { ok: true };
    } catch (e) {
      fail(e);
    }
  });

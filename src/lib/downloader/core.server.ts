/**
 * Server-only downloader helpers: privileged DB access, rate limiting,
 * audit + analytics logging, platform resolution and job <-> worker sync.
 */
import { checkMediaUrl, isDirectMediaUrl, hashUrl } from "./url";
import { canTransition, isActive, safeErrorMessage, type JobStatus } from "./state";
import { workerClient, WorkerError } from "./worker-client.server";

export async function admin(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export class DlError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? safeErrorMessage(code));
    this.code = code;
  }
}

export type DownloaderSettings = {
  site_name: string;
  logo_url: string | null;
  support_email: string | null;
  terms_url: string | null;
  privacy_url: string | null;
  footer_text: string | null;
  meta_title: string;
  meta_description: string;
  guest_downloads_enabled: boolean;
  require_account: boolean;
  downloads_paused: boolean;
  maintenance_mode: boolean;
  file_lifetime_minutes: number;
  max_file_size_mb: number;
  max_concurrent_jobs_per_user: number;
  max_concurrent_jobs_global: number;
  guest_requests_per_hour: number;
  user_requests_per_hour: number;
  metadata_requests_per_minute: number;
  metadata_cache_minutes: number;
  updated_at: string;
};

export async function getSettings(): Promise<DownloaderSettings> {
  const db = await admin();
  const { data, error } = await db.from("downloader_settings").select("*").eq("id", 1).maybeSingle();
  if (error || !data) throw new DlError("database_failure");
  return data as DownloaderSettings;
}

function windowStart(scope: "minute" | "hour"): string {
  const d = new Date();
  d.setUTCSeconds(0, 0);
  if (scope === "hour") d.setUTCMinutes(0);
  return d.toISOString();
}

/** Fixed-window counter. Throws rate_limited when the limit is exceeded. */
export async function enforceRateLimit(
  bucket: string,
  scope: string,
  window: "minute" | "hour",
  limit: number,
): Promise<number> {
  const db = await admin();
  const { data, error } = await db.rpc("hit_rate_limit", {
    _bucket: bucket,
    _scope: scope,
    _window_start: windowStart(window),
  });
  if (error) {
    console.error(JSON.stringify({ scope: "rate_limit", error: error.message }));
    throw new DlError("database_failure");
  }
  const count = Number(data ?? 0);
  if (count > limit) throw new DlError("rate_limited");
  return count;
}

export async function audit(entry: {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  target?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const db = await admin();
    await db.from("audit_logs").insert({
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
      action: entry.action,
      target: entry.target ?? null,
      metadata: entry.metadata ?? {},
    });
  } catch (e) {
    console.error(JSON.stringify({ scope: "audit", error: String(e) }));
  }
}

export async function track(event: {
  event: string;
  userId?: string | null;
  jobId?: string | null;
  platform?: string | null;
  format?: string | null;
  status?: string | null;
  durationMs?: number | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const db = await admin();
    await db.from("analytics_events").insert({
      event: event.event,
      user_id: event.userId ?? null,
      job_id: event.jobId ?? null,
      platform: event.platform ?? null,
      format: event.format ?? null,
      status: event.status ?? null,
      duration_ms: event.durationMs ?? null,
      metadata: event.metadata ?? {},
    });
  } catch (e) {
    console.error(JSON.stringify({ scope: "analytics", error: String(e) }));
  }
}

export type ResolvedUrl = {
  normalized: string;
  host: string;
  urlHash: string;
  platform: { name: string; domain: string };
};

/** Validates the URL (SSRF guard) and matches it against the platform registry. */
export async function resolveMediaUrl(raw: string): Promise<ResolvedUrl> {
  const check = checkMediaUrl(raw);
  if (!check.ok) throw new DlError(check.code, check.message);
  const db = await admin();
  const { data: rows } = await db
    .from("platforms")
    .select("name, domain, enabled")
    .in("domain", [check.platformDomain, check.host, "*"]);
  const list = (rows ?? []) as { name: string; domain: string; enabled: boolean }[];
  let match =
    list.find((p) => p.domain === check.host) ?? list.find((p) => p.domain === check.platformDomain);
  if (!match && isDirectMediaUrl(check.normalized)) match = list.find((p) => p.domain === "*");
  if (!match) throw new DlError("unsupported_platform");
  if (!match.enabled) throw new DlError("platform_disabled");
  return {
    normalized: check.normalized,
    host: check.host,
    urlHash: await hashUrl(check.normalized),
    platform: { name: match.name, domain: match.domain },
  };
}

export async function assertServiceOpen(settings: DownloaderSettings) {
  if (settings.maintenance_mode) throw new DlError("downloads_paused", "The downloader is in maintenance mode. Please try again later.");
  if (settings.downloads_paused) throw new DlError("downloads_paused");
}

const WORKER_TO_JOB: Record<string, JobStatus> = {
  queued: "queued",
  analyzing: "analyzing",
  downloading: "processing",
  processing: "processing",
  converting: "converting",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
  expired: "expired",
};

function transitionPath(from: JobStatus, to: JobStatus): JobStatus[] {
  if (from === to) return [];
  if (canTransition(from, to)) return [to];
  if (canTransition(from, "processing") && canTransition("processing", to)) return ["processing", to];
  return [];
}

async function applyStatus(db: any, job: any, to: JobStatus, patch: Record<string, unknown>) {
  const steps = transitionPath(job.status, to);
  let current = job;
  if (steps.length === 0) {
    if (Object.keys(patch).length === 0) return current;
    const { data } = await db.from("download_jobs").update(patch).eq("id", job.id).select("*").single();
    return data ?? current;
  }
  for (let i = 0; i < steps.length; i++) {
    const last = i === steps.length - 1;
    const { data, error } = await db
      .from("download_jobs")
      .update(last ? { ...patch, status: steps[i] } : { status: steps[i] })
      .eq("id", job.id)
      .select("*")
      .single();
    if (error) {
      console.error(JSON.stringify({ scope: "job_sync", job: job.id, error: error.message }));
      return current;
    }
    current = data;
  }
  return current;
}

/** Pull the latest state for an active job from the worker and persist it. */
export async function syncJob(job: any): Promise<any> {
  const db = await admin();
  // Expire completed files past their lifetime
  if (job.status === "completed" && job.expires_at && new Date(job.expires_at).getTime() < Date.now()) {
    return applyStatus(db, job, "expired", {});
  }
  if (!isActive(job.status) || !job.worker_job_id) return job;

  let state;
  try {
    state = await workerClient.jobState(job.worker_job_id);
  } catch (err) {
    const code = err instanceof WorkerError ? err.code : "worker_unavailable";
    // A 404 means the worker no longer knows this job (restart / cleanup).
    if (code === "media_unavailable" || code === "job_not_found") {
      return applyStatus(db, job, "failed", {
        error_code: "worker_unavailable",
        error_message: "The processing worker lost this job (it may have restarted). Retry the download.",
      });
    }
    // Stale active job with an unreachable worker for > 30 minutes -> fail it.
    if (Date.now() - new Date(job.updated_at).getTime() > 30 * 60_000) {
      return applyStatus(db, job, "failed", { error_code: code, error_message: safeErrorMessage(code) });
    }
    return job;
  }

  const target = WORKER_TO_JOB[state.status] ?? job.status;
  const patch: Record<string, unknown> = {};
  if (typeof state.progress === "number") patch["progress"] = Math.max(0, Math.min(100, Math.round(state.progress)));
  if (state.title && !job.media_title) patch["media_title"] = state.title;

  if (target === "completed") {
    const settings = await getSettings();
    patch["progress"] = 100;
    patch["output_filename"] = state.outputFilename ?? job.output_filename;
    patch["output_size"] = state.outputSize ?? job.output_size;
    patch["temporary_storage_path"] = state.storagePath ?? null;
    patch["completed_at"] = new Date().toISOString();
    patch["expires_at"] = new Date(Date.now() + settings.file_lifetime_minutes * 60_000).toISOString();
    patch["error_code"] = null;
    patch["error_message"] = null;
  }
  if (target === "failed") {
    const code = state.errorCode ?? "extraction_failed";
    patch["error_code"] = code;
    patch["error_message"] = safeErrorMessage(code);
  }

  const updated = await applyStatus(db, job, target, patch);
  if (job.status !== updated.status && (updated.status === "completed" || updated.status === "failed")) {
    const started = job.started_at ? new Date(job.started_at).getTime() : new Date(job.created_at).getTime();
    await track({
      event: updated.status === "completed" ? "download_completed" : "download_failed",
      userId: job.user_id,
      jobId: job.id,
      platform: job.source_platform,
      format: job.requested_format,
      status: updated.status,
      durationMs: Date.now() - started,
      metadata: updated.status === "failed" ? { error_code: updated.error_code } : { size: updated.output_size },
    });
  }
  return updated;
}

/** Public-safe job projection (never exposes worker ids, storage paths or IP hashes). */
export function publicJob(j: any) {
  return {
    id: j.id as string,
    source_url: j.source_url as string,
    source_platform: j.source_platform as string | null,
    media_title: j.media_title as string | null,
    media_type: j.media_type as string | null,
    requested_format: j.requested_format as string,
    requested_quality: j.requested_quality as string | null,
    status: j.status as JobStatus,
    progress: j.progress as number,
    attempts: j.attempts as number,
    max_attempts: j.max_attempts as number,
    error_code: j.error_code as string | null,
    error_message: j.error_message as string | null,
    output_filename: j.output_filename as string | null,
    output_size: j.output_size as number | null,
    thumbnail: (j.metadata?.thumbnail as string | undefined) ?? null,
    duration: (j.metadata?.duration as number | undefined) ?? null,
    created_at: j.created_at as string,
    completed_at: j.completed_at as string | null,
    expires_at: j.expires_at as string | null,
  };
}

export type PublicJob = ReturnType<typeof publicJob>;

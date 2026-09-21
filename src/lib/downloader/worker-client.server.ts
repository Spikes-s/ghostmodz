/**
 * Media extraction worker client.
 *
 * The worker is a separately deployed service running yt-dlp + FFmpeg
 * (see DEPLOYMENT.md). Configure it with the WORKER_API_URL and
 * WORKER_API_SECRET secrets. Nothing here ever runs yt-dlp locally.
 *
 * Worker contract:
 *   GET  /health
 *   POST /analyze        { url }                       -> metadata + formats
 *   POST /jobs           { jobId, url, format, quality, maxSizeMb, ttlMinutes }
 *   GET  /jobs/:id                                     -> status/progress/output
 *   POST /jobs/:id/cancel
 *   POST /jobs/:id/retry
 *   POST /jobs/:id/download-url                        -> short lived signed URL
 *   POST /cleanup        { }                           -> expired file cleanup
 */

export type WorkerFormat = {
  id: string;
  container: string;
  kind: "video" | "audio" | "image";
  quality: string | null;
  height?: number | null;
  bitrate?: number | null;
  codec?: string | null;
  filesize?: number | null;
  requiresConversion?: boolean;
};

export type WorkerMetadata = {
  title: string | null;
  duration: number | null;
  thumbnail: string | null;
  uploader: string | null;
  platform: string | null;
  mediaType: "video" | "audio" | "image" | null;
  webpageUrl?: string | null;
  formats: WorkerFormat[];
};

export type WorkerJobState = {
  status: string;
  progress?: number | null;
  errorCode?: string | null;
  outputFilename?: string | null;
  outputSize?: number | null;
  storagePath?: string | null;
  title?: string | null;
};

export type WorkerHealth = {
  configured: boolean;
  online: boolean;
  version?: string | null;
  activeJobs?: number | null;
  queueLength?: number | null;
  cpuPercent?: number | null;
  memoryPercent?: number | null;
  ytdlp?: string | null;
  ffmpeg?: string | null;
  error?: string | null;
  latencyMs?: number | null;
};

export class WorkerError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

function config(): { url: string; secret: string } | null {
  const url = process.env["WORKER_API_URL"];
  const secret = process.env["WORKER_API_SECRET"];
  if (!url || !secret) return null;
  return { url: url.replace(/\/+$/, ""), secret };
}

export function isWorkerConfigured(): boolean {
  return config() !== null;
}

async function call<T>(
  path: string,
  init: { method?: string; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  const cfg = config();
  if (!cfg) throw new WorkerError("worker_unconfigured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 20_000);
  try {
    const res = await fetch(`${cfg.url}${path}`, {
      method: init.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.secret}`,
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    if (!res.ok) {
      const code = parsed?.code ?? (res.status === 404 ? "media_unavailable" : "extraction_failed");
      console.error(
        JSON.stringify({ scope: "worker", path, status: res.status, code }),
      );
      throw new WorkerError(code);
    }
    return parsed as T;
  } catch (err: any) {
    if (err instanceof WorkerError) throw err;
    if (err?.name === "AbortError") throw new WorkerError("timeout");
    console.error(JSON.stringify({ scope: "worker", path, error: "network_failure" }));
    throw new WorkerError("worker_unavailable");
  } finally {
    clearTimeout(timer);
  }
}

export const workerClient = {
  configured: isWorkerConfigured,

  async health(): Promise<WorkerHealth> {
    if (!isWorkerConfigured())
      return { configured: false, online: false, error: "worker_unconfigured" };
    const started = Date.now();
    try {
      const data = await call<any>("/health", { timeoutMs: 8000 });
      return {
        configured: true,
        online: true,
        version: data?.version ?? null,
        activeJobs: data?.activeJobs ?? null,
        queueLength: data?.queueLength ?? null,
        cpuPercent: data?.cpuPercent ?? null,
        memoryPercent: data?.memoryPercent ?? null,
        ytdlp: data?.ytdlp ?? null,
        ffmpeg: data?.ffmpeg ?? null,
        latencyMs: Date.now() - started,
      };
    } catch (err: any) {
      return {
        configured: true,
        online: false,
        error: err?.code ?? "worker_unavailable",
        latencyMs: Date.now() - started,
      };
    }
  },

  analyze(url: string): Promise<WorkerMetadata> {
    return call<WorkerMetadata>("/analyze", {
      method: "POST",
      body: { url },
      timeoutMs: 30_000,
    });
  },

  createJob(input: {
    jobId: string;
    url: string;
    format: string;
    quality: string | null;
    formatId?: string | null;
    maxSizeMb: number;
    ttlMinutes: number;
  }): Promise<{ workerJobId: string; status?: string }> {
    return call("/jobs", { method: "POST", body: input, timeoutMs: 20_000 });
  },

  jobState(workerJobId: string): Promise<WorkerJobState> {
    return call(`/jobs/${encodeURIComponent(workerJobId)}`, { timeoutMs: 12_000 });
  },

  cancelJob(workerJobId: string): Promise<{ ok: boolean }> {
    return call(`/jobs/${encodeURIComponent(workerJobId)}/cancel`, { method: "POST" });
  },

  downloadUrl(workerJobId: string): Promise<{ url: string; expiresInSeconds?: number }> {
    return call(`/jobs/${encodeURIComponent(workerJobId)}/download-url`, { method: "POST" });
  },

  cleanup(): Promise<{ deleted: number; failed: number }> {
    return call("/cleanup", { method: "POST", timeoutMs: 30_000 });
  },
};

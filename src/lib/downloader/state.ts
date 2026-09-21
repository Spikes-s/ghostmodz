/** Job state machine, format rules and safe error mapping. Pure + testable. */

export const JOB_STATUSES = [
  "queued",
  "analyzing",
  "processing",
  "converting",
  "completed",
  "failed",
  "expired",
  "cancelled",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

const TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  queued: ["analyzing", "processing", "failed", "cancelled", "expired"],
  analyzing: ["processing", "converting", "completed", "failed", "cancelled"],
  processing: ["converting", "completed", "failed", "cancelled"],
  converting: ["completed", "failed", "cancelled"],
  completed: ["expired"],
  failed: ["queued"],
  cancelled: ["queued"],
  expired: [],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(status: JobStatus): boolean {
  return ["completed", "failed", "expired", "cancelled"].includes(status);
}

export function isActive(status: JobStatus): boolean {
  return ["queued", "analyzing", "processing", "converting"].includes(status);
}

export const OUTPUT_FORMATS = ["mp4", "mp3", "wav", "m4a", "webm", "image"] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export function isValidFormat(value: string): value is OutputFormat {
  return (OUTPUT_FORMATS as readonly string[]).includes(value);
}

export function formatKind(format: OutputFormat): "video" | "audio" | "image" {
  if (format === "image") return "image";
  if (format === "mp4" || format === "webm") return "video";
  return "audio";
}

/** Machine readable error codes surfaced to users and diagnostics. */
export const ERROR_MESSAGES: Record<string, string> = {
  invalid_url: "That does not look like a valid URL.",
  unsupported_protocol: "Only http and https links are supported.",
  blocked_host: "That address is not allowed.",
  credentials_in_url: "Links containing credentials are not accepted.",
  too_long: "That URL is too long to process.",
  unsupported_platform: "Unsupported or unavailable media source.",
  platform_disabled: "This source is currently disabled by the administrator.",
  media_unavailable:
    "Unable to process this URL. The source may be unsupported, unavailable, private, or temporarily inaccessible.",
  private_content: "This media is private or protected and cannot be downloaded.",
  drm_protected: "This media is protected by DRM and cannot be downloaded.",
  extraction_failed: "The media could not be read from the source.",
  conversion_failed: "The requested format could not be produced for this media.",
  worker_unavailable:
    "The media processing service is not reachable right now. Please try again shortly.",
  worker_unconfigured:
    "The media processing worker has not been configured yet. An administrator must finish setup.",
  rate_limited: "You have made too many requests. Please wait a moment and try again.",
  timeout: "The operation took too long and was stopped.",
  file_expired: "This file has expired and is no longer available.",
  storage_failure: "The processed file could not be stored.",
  database_failure: "A storage error occurred. Please try again.",
  network_failure: "A network error occurred while contacting the media service.",
  too_large: "The requested file exceeds the maximum allowed size.",
  concurrency_limit: "You already have the maximum number of downloads in progress.",
  downloads_paused: "Downloads are temporarily paused by the administrator.",
  account_required: "Sign in to use the downloader.",
  max_attempts: "This job failed repeatedly and will not be retried automatically.",
  forbidden: "You are not allowed to perform this action.",
  unknown: "Something went wrong. Please try again.",
};

export function safeErrorMessage(code: string | null | undefined): string {
  if (!code) return ERROR_MESSAGES["unknown"]!;
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES["unknown"]!;
}

export function humanSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function humanDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/**
 * URL validation, normalization and SSRF protection for the media downloader.
 * Pure functions only - safe to import from both client and server code.
 */

export type UrlCheckError =
  | "invalid_url"
  | "unsupported_protocol"
  | "blocked_host"
  | "credentials_in_url"
  | "too_long"
  | "unsupported_platform";

export type UrlCheck =
  | { ok: true; normalized: string; host: string; platformDomain: string }
  | { ok: false; code: UrlCheckError; message: string };

const MAX_URL_LENGTH = 2048;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata",
  "metadata.google.internal",
  "instance-data",
  "169.254.169.254",
  "0.0.0.0",
  "[::]",
  "[::1]",
]);

/** Tracking / session params stripped during normalization. */
const STRIP_PARAMS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^igshid$/i,
  /^si$/i,
  /^feature$/i,
  /^ref$/i,
  /^ref_src$/i,
  /^ref_url$/i,
  /^_ga$/i,
];

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([a, Number(m[2]), Number(m[3]), Number(m[4])].some((n) => n > 255)) return true;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && (b === 168 || b === 0)) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateIPv6(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!h.includes(":")) return false;
  if (h === "::" || h === "::1") return true;
  if (h.startsWith("fe80") || h.startsWith("fec0")) return true; // link/site local
  if (/^f[cd]/.test(h)) return true; // unique local
  if (h.startsWith("::ffff:")) {
    const v4 = h.slice(7);
    return isPrivateIPv4(v4);
  }
  return false;
}

/** True when the host must never be requested by the backend (SSRF guard). */
export function isBlockedHost(hostnameRaw: string): boolean {
  const hostname = hostnameRaw.trim().toLowerCase().replace(/\.$/, "");
  if (!hostname) return true;
  if (BLOCKED_HOSTNAMES.has(hostname)) return true;
  if (hostname.endsWith(".localhost") || hostname.endsWith(".local")) return true;
  if (hostname.endsWith(".internal") || hostname.endsWith(".intranet")) return true;
  if (hostname.endsWith(".home.arpa") || hostname.endsWith(".lan")) return true;
  if (!hostname.includes(".") && !hostname.includes(":")) return true; // bare internal hostname
  if (isPrivateIPv4(hostname)) return true;
  if (isPrivateIPv6(hostname)) return true;
  // Decimal / octal / hex encoded IPv4 shorthand (e.g. http://2130706433)
  if (/^\d+$/.test(hostname) || /^0x[0-9a-f]+$/.test(hostname)) return true;
  return false;
}

/** Registrable-ish domain used to match the platform registry. */
export function platformDomain(hostname: string): string {
  const h = hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  const parts = h.split(".");
  if (parts.length <= 2) return h;
  const twoLevelTlds = ["co.uk", "com.au", "co.nz", "co.za", "com.br", "co.ke"];
  const last2 = parts.slice(-2).join(".");
  if (twoLevelTlds.includes(last2)) return parts.slice(-3).join(".");
  return last2;
}

/** Validate + normalize a user supplied media URL. */
export function checkMediaUrl(input: string): UrlCheck {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, code: "invalid_url", message: "Enter a media URL." };
  if (raw.length > MAX_URL_LENGTH)
    return { ok: false, code: "too_long", message: "That URL is too long to process." };

  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return { ok: false, code: "invalid_url", message: "That does not look like a valid URL." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:")
    return {
      ok: false,
      code: "unsupported_protocol",
      message: "Only http and https links are supported.",
    };

  if (url.username || url.password)
    return {
      ok: false,
      code: "credentials_in_url",
      message: "Links containing credentials are not accepted.",
    };

  if (url.port && !["80", "443", ""].includes(url.port))
    return { ok: false, code: "blocked_host", message: "That address is not allowed." };

  if (isBlockedHost(url.hostname))
    return { ok: false, code: "blocked_host", message: "That address is not allowed." };

  // Normalize
  url.protocol = "https:";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.hash = "";
  url.port = "";
  const params = [...url.searchParams.keys()];
  for (const key of params) {
    if (STRIP_PARAMS.some((re) => re.test(key))) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  if (url.pathname.length > 1 && url.pathname.endsWith("/"))
    url.pathname = url.pathname.replace(/\/+$/, "");

  return {
    ok: true,
    normalized: url.toString(),
    host: url.hostname,
    platformDomain: platformDomain(url.hostname),
  };
}

const DIRECT_MEDIA_EXT = /\.(mp4|m4a|mp3|wav|webm|mov|mkv|ogg|opus|flac|aac)$/i;

export function isDirectMediaUrl(normalized: string): boolean {
  try {
    return DIRECT_MEDIA_EXT.test(new URL(normalized).pathname);
  } catch {
    return false;
  }
}

/** Safe, brand prefixed output filename. Never returns a path. */
export function safeFilename(
  title: string | null | undefined,
  quality: string | null | undefined,
  ext: string,
  brand = "Ghost_Mods_Tech",
): string {
  const cleanExt = (ext || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
  const base = (title ?? "media")
    .normalize("NFKD")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
  const q = (quality ?? "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 12);
  return [brand, base || "media", q].filter(Boolean).join("_") + "." + cleanExt;
}

/** Stable hash of a normalized URL, used for caching + indexes. */
export async function hashUrl(normalized: string): Promise<string> {
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashIp(ip: string, salt: string): Promise<string> {
  return (await hashUrl(`${salt}:${ip}`)).slice(0, 32);
}

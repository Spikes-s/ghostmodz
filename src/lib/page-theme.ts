/**
 * Page theme map — gives every major area its own visual identity
 * while keeping the shared Ghost Mods Tech cyberpunk design system.
 *
 * The theme class is applied to the authenticated layout wrapper and
 * PageAmbience renders the matching background environment.
 */

export type AmbienceVariant =
  | "gateway"    // Homepage — futuristic digital gateway
  | "lab"        // Downloader — media processing lab
  | "studio"     // Results / services / cloud — digital media studio
  | "command"    // User dashboard, chat & workspace — command center
  | "ops"        // Admin — professional operations center
  | "console"    // Terminal — cybersecurity console
  | "portal"     // Auth / payment — secure access portal
  | "editorial"; // Support & academy — readable editorial environment

export interface PageTheme {
  className: string;
  ambience: AmbienceVariant;
}

const COMMAND: PageTheme = { className: "theme-command", ambience: "command" };

export function pageTheme(pathname: string): PageTheme {
  if (pathname.startsWith("/admin")) return { className: "theme-ops", ambience: "ops" };
  if (pathname.startsWith("/downloader/history")) return { className: "theme-command", ambience: "command" };
  if (pathname.startsWith("/downloader")) return { className: "theme-lab", ambience: "lab" };
  if (pathname.startsWith("/terminal")) return { className: "theme-console", ambience: "console" };
  if (pathname.startsWith("/account/requests")) return COMMAND;
  if (pathname.startsWith("/account")) return COMMAND;
  if (pathname.startsWith("/support")) return { className: "theme-editorial", ambience: "editorial" };
  if (pathname.startsWith("/academy")) return { className: "theme-editorial", ambience: "editorial" };
  if (pathname.startsWith("/services")) return { className: "theme-studio", ambience: "studio" };
  if (pathname.startsWith("/cloud")) return { className: "theme-studio", ambience: "studio" };
  if (pathname.startsWith("/spikes") || pathname.startsWith("/build")) return COMMAND;
  if (pathname === "/" || pathname === "") return { className: "theme-gateway", ambience: "gateway" };
  return COMMAND;
}

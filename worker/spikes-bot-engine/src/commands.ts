import { calculate } from "./calculator.js";

export type CommandContext = {
  ownerJid?: string;
  ownerLabel?: string;
  repositoryUrl?: string;
  prefix: string;
  uptimeSeconds: number;
  connected: boolean;
};

export type CommandInfo = {
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  readiness: "ready" | "missing_configuration";
  missingConfiguration: string[];
};

type Definition = Omit<CommandInfo, "enabled" | "readiness" | "missingConfiguration"> & {
  requires?: Array<"owner" | "repo">;
};

const definitions: Definition[] = [
  { name: "menu", description: "Show enabled commands", category: "Information" },
  { name: "help", description: "Explain a command and its usage", category: "Information" },
  { name: "alive", description: "Check the actual linked WhatsApp connection", category: "Information" },
  { name: "ping", description: "Measure command-processing latency", category: "Information" },
  { name: "uptime", description: "Show the service process uptime", category: "Information" },
  { name: "spikes", description: "Show SPIKES BOT identity", category: "Information" },
  { name: "calc", description: "Calculate safe arithmetic expressions", category: "Tools" },
  { name: "fancy", description: "Convert text to bold sans Unicode", category: "Tools" },
  { name: "owner", description: "Show configured bot owner", category: "Information", requires: ["owner"] },
  { name: "repo", description: "Show the configured source repository", category: "Information", requires: ["repo"] },
];

const fancyUpper = 0x1d5d4;
const fancyLower = 0x1d5ee;
const fancyDigits = 0x1d7ec;

export function formatFancy(input: string) {
  return Array.from(input, (character) => {
    const code = character.codePointAt(0) ?? 0;
    if (code >= 65 && code <= 90) return String.fromCodePoint(fancyUpper + code - 65);
    if (code >= 97 && code <= 122) return String.fromCodePoint(fancyLower + code - 97);
    if (code >= 48 && code <= 57) return String.fromCodePoint(fancyDigits + code - 48);
    return character;
  }).join("");
}

export function getCommandCatalog(context: CommandContext, configured: Record<string, boolean> = {}): CommandInfo[] {
  return definitions.map((item) => {
    const missingConfiguration = (item.requires ?? []).filter((name) => name === "owner" ? !context.ownerJid : !context.repositoryUrl);
    return {
      name: item.name,
      description: item.description,
      category: item.category,
      enabled: configured[item.name] ?? true,
      readiness: missingConfiguration.length ? "missing_configuration" : "ready",
      missingConfiguration,
    };
  });
}

export function parseCommand(text: string, prefix = ".") {
  const trimmed = text.trim();
  if (!trimmed.startsWith(prefix)) return null;
  const body = trimmed.slice(prefix.length).trim();
  const [name, ...args] = body.split(/\s+/).filter(Boolean);
  if (!name) return null;
  return { name: name.toLowerCase(), args, argumentText: args.join(" ") };
}

export function executeCommand(text: string, context: CommandContext, configured: Record<string, boolean> = {}, latencyMs = 0) {
  const parsed = parseCommand(text, context.prefix);
  if (!parsed) return null;
  const catalog = getCommandCatalog(context, configured);
  const command = catalog.find((item) => item.name === parsed.name);
  if (!command) return { command: parsed.name, text: `Unknown command. Send ${context.prefix}menu to see available commands.` };
  if (!command.enabled) return { command: parsed.name, text: `The ${context.prefix}${parsed.name} command is disabled by the bot owner.` };
  if (command.readiness !== "ready") return { command: parsed.name, text: `${context.prefix}${parsed.name} is unavailable until ${command.missingConfiguration.join(" and ")} is configured.` };

  let response: string;
  switch (parsed.name) {
    case "menu":
      response = menuText(context, catalog);
      break;
    case "help": {
      const target = parsed.args[0]?.toLowerCase();
      const item = target ? catalog.find((entry) => entry.name === target && entry.enabled && entry.readiness === "ready") : undefined;
      response = target
        ? item ? `${context.prefix}${item.name} — ${item.description}.` : `That command is unavailable. Send ${context.prefix}menu for ready commands.`
        : `Send ${context.prefix}menu to see available commands. Commands use the ${context.prefix} prefix; follow a command with its arguments where required.`;
      break;
    }
    case "alive":
      response = context.connected ? "SPIKES BOT is connected to WhatsApp and responding." : "SPIKES BOT service is running, but WhatsApp is not connected.";
      break;
    case "ping":
      response = `SPIKES BOT is responding. Command processing: ${Math.max(0, Math.round(latencyMs))} ms.`;
      break;
    case "uptime":
      response = `SPIKES BOT service uptime: ${formatUptime(context.uptimeSeconds)}.`;
      break;
    case "spikes":
      response = "👻 SPIKES BOT — powered by GHOST MODS TECH.";
      break;
    case "calc":
      if (!parsed.argumentText) response = `Usage: ${context.prefix}calc 12 * (4 + 2)`;
      else {
        try { response = `Result: ${calculate(parsed.argumentText)}`; }
        catch (error) { response = error instanceof Error ? error.message : "That calculation could not be completed."; }
      }
      break;
    case "fancy":
      response = parsed.argumentText ? formatFancy(parsed.argumentText) : `Usage: ${context.prefix}fancy text to format`;
      break;
    case "owner":
      response = context.ownerLabel ? `SPIKES BOT owner: ${context.ownerLabel}.` : `SPIKES BOT owner: +${context.ownerJid?.split("@")[0]}.`;
      break;
    case "repo":
      response = context.repositoryUrl ?? "The source repository is not configured.";
      break;
    default:
      response = `Send ${context.prefix}menu to see available commands.`;
  }
  return { command: parsed.name, text: response };
}

function menuText(context: CommandContext, catalog: CommandInfo[]) {
  const ready = catalog.filter((item) => item.enabled && item.readiness === "ready");
  const categories = new Map<string, string[]>();
  for (const item of ready) {
    const names = categories.get(item.category) ?? [];
    names.push(`${context.prefix}${item.name}`);
    categories.set(item.category, names);
  }
  const body = Array.from(categories, ([category, names]) => `${category}\n${names.join("  ·  ")}`).join("\n\n");
  return `👻 SPIKES BOT COMMAND MENU\nPowered by GHOST MODS TECH\n\n${body}`;
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [days ? `${days}d` : "", hours ? `${hours}h` : "", `${minutes}m`].filter(Boolean);
  return parts.join(" ");
}
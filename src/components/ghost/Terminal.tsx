import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { X, Plus, Maximize2, Minimize2, Menu, Volume2, VolumeX, Trash2 } from "lucide-react";

// ---------- Types ----------
export type ShellFile = { path: string; content: string };

export type TerminalProps = {
  files: ShellFile[];
  projectName?: string;
  onClose: () => void;
  onUpsert?: (path: string, content: string) => Promise<void> | void;
  onDelete?: (path: string) => Promise<void> | void;
  onRename?: (from: string, to: string) => Promise<void> | void;
  onPreviewRefresh?: () => void;
  onOpenFile?: (path: string) => void;
};

type Line = { kind: "out" | "in" | "err" | "ok"; text: string };
type Tab = {
  id: string;
  title: string;
  cwd: string; // "" = root, e.g. "src/components"
  lines: Line[];
  history: string[];
  histIdx: number;
  input: string;
};

// ---------- Path helpers ----------
function resolvePath(cwd: string, target: string): string {
  if (!target || target === ".") return cwd;
  if (target === "~" || target === "/") return "";
  const base = target.startsWith("/") ? "" : cwd;
  const parts = (base + "/" + target).split("/").filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    if (p === ".") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  return out.join("/");
}

function pathExists(files: ShellFile[], p: string): "file" | "dir" | null {
  if (p === "") return "dir";
  if (files.some((f) => f.path === p)) return "file";
  const prefix = p + "/";
  if (files.some((f) => f.path.startsWith(prefix))) return "dir";
  return null;
}

function listDir(files: ShellFile[], dir: string): { name: string; isFile: boolean }[] {
  const prefix = dir ? dir + "/" : "";
  const seen = new Map<string, boolean>();
  for (const f of files) {
    if (!f.path.startsWith(prefix)) continue;
    const rest = f.path.slice(prefix.length);
    if (!rest) continue;
    const slash = rest.indexOf("/");
    const name = slash === -1 ? rest : rest.slice(0, slash);
    const isFile = slash === -1;
    if (!seen.has(name)) seen.set(name, isFile);
    else if (!isFile) seen.set(name, false);
  }
  return [...seen.entries()]
    .map(([name, isFile]) => ({ name, isFile }))
    .sort((a, b) => Number(a.isFile) - Number(b.isFile) || a.name.localeCompare(b.name));
}

// ---------- Sound ----------
function useKeyClick(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  return useCallback(() => {
    if (!enabled) return;
    try {
      if (!ctxRef.current) {
        const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
        ctxRef.current = new AC();
      }
      const ctx = ctxRef.current!;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = 1100 + Math.random() * 300;
      g.gain.value = 0.025;
      o.connect(g).connect(ctx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);
      o.stop(ctx.currentTime + 0.04);
    } catch {
      /* ignore */
    }
  }, [enabled]);
}

// ---------- Component ----------
const KALI = {
  green: "#5cff7a",
  dim: "#1aff80",
  user: "#5cff7a",
  host: "#5cff7a",
  path: "#4fc3f7",
  arrow: "#ff4fa1",
};

let tabSeq = 1;
function makeTab(initialLines?: Line[]): Tab {
  return {
    id: `t${tabSeq++}`,
    title: `ghost@spikes ~${tabSeq === 2 ? "" : ` ${tabSeq - 1}`}`,
    cwd: "",
    lines: initialLines ?? [
      { kind: "ok", text: "┌─[ Ghost Shell v2.0 ]─[ kali-cyber ]" },
      { kind: "ok", text: "└─ Type 'help' for commands. 'ls' to view project files." },
    ],
    history: [],
    histIdx: -1,
    input: "",
  };
}

export function Terminal(props: TerminalProps) {
  const { files, projectName, onClose, onUpsert, onDelete, onRename, onPreviewRefresh, onOpenFile } = props;

  const [tabs, setTabs] = useState<Tab[]>(() => [makeTab()]);
  const [activeId, setActiveId] = useState(tabs[0].id);
  const [fullscreen, setFullscreen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sound, setSound] = useState(true);
  const [fontSize, setFontSize] = useState(12);
  const [accent, setAccent] = useState<keyof typeof THEMES>("kali");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const click = useKeyClick(sound);

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const theme = THEMES[accent];

  const updateActive = useCallback(
    (fn: (t: Tab) => Tab) =>
      setTabs((ts) => ts.map((t) => (t.id === activeId ? fn(t) : t))),
    [activeId],
  );

  function appendLines(lines: Line[]) {
    updateActive((t) => ({ ...t, lines: [...t.lines, ...lines] }));
  }

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [active.lines.length, activeId]);

  // Focus input on tab switch/open
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeId, fullscreen]);

  // ---------- Command runner ----------
  async function runCommand(raw: string) {
    const cmd = raw.trim();
    const prompt = renderPrompt(active.cwd);
    appendLines([{ kind: "in", text: `${prompt} ${cmd}` }]);
    if (!cmd) return;

    const argv = tokenize(cmd);
    const head = argv[0];
    const rest = argv.slice(1);

    try {
      switch (head) {
        case "help": {
          appendLines([
            { kind: "out", text: "available commands:" },
            { kind: "out", text: "  ls [path]         list directory" },
            { kind: "out", text: "  cd <path>         change directory" },
            { kind: "out", text: "  pwd               print working directory" },
            { kind: "out", text: "  tree              recursive listing" },
            { kind: "out", text: "  cat <file>        print file" },
            { kind: "out", text: "  open <file>       open file in editor" },
            { kind: "out", text: "  touch <file>      create empty file" },
            { kind: "out", text: "  mkdir <dir>       create folder" },
            { kind: "out", text: "  rm <path>         delete file or folder" },
            { kind: "out", text: "  mv <a> <b>        rename / move" },
            { kind: "out", text: "  echo <text> > <file>   write text to file" },
            { kind: "out", text: "  preview | build   refresh live preview" },
            { kind: "out", text: "  neofetch          system info" },
            { kind: "out", text: "  whoami            current user" },
            { kind: "out", text: "  clear             clear screen" },
          ]);
          break;
        }
        case "clear":
          updateActive((t) => ({ ...t, lines: [] }));
          break;
        case "pwd":
          appendLines([{ kind: "out", text: "/" + active.cwd }]);
          break;
        case "whoami":
          appendLines([{ kind: "out", text: "ghost@spikes" }]);
          break;
        case "neofetch": {
          appendLines([
            { kind: "ok", text: "    ╲╱╲╱   ghost@spikes" },
            { kind: "ok", text: "   ╱╲╱╲    ─────────────" },
            { kind: "out", text: "   ▓▓▓▓    OS:      GhostOS 2.0 (kali-cyber)" },
            { kind: "out", text: "   ▓▓▓▓    Shell:   GhostShell 2.0" },
            { kind: "out", text: `   ▓▓▓▓    Project: ${projectName ?? "—"}` },
            { kind: "out", text: `   ▓▓▓▓    Files:   ${files.length}` },
            { kind: "out", text: "   ▓▓▓▓    Theme:   neon-purple/cyan" },
          ]);
          break;
        }
        case "ls": {
          const dir = resolvePath(active.cwd, rest[0] ?? "");
          if (pathExists(files, dir) !== "dir" && dir !== "") {
            appendLines([{ kind: "err", text: `ls: cannot access '${rest[0]}': no such directory` }]);
            break;
          }
          const items = listDir(files, dir);
          if (items.length === 0) appendLines([{ kind: "out", text: "(empty)" }]);
          else
            appendLines(
              items.map((i) => ({
                kind: "out" as const,
                text: i.isFile ? `  ${i.name}` : `  ${i.name}/`,
              })),
            );
          break;
        }
        case "tree": {
          const dir = active.cwd;
          const inside = files.filter((f) => (dir ? f.path.startsWith(dir + "/") : true));
          appendLines(
            inside.map((f) => ({
              kind: "out" as const,
              text: "  " + (dir ? f.path.slice(dir.length + 1) : f.path),
            })),
          );
          break;
        }
        case "cd": {
          const target = rest[0] ?? "";
          const next = resolvePath(active.cwd, target);
          if (next !== "" && pathExists(files, next) !== "dir") {
            appendLines([{ kind: "err", text: `cd: not a directory: ${target}` }]);
          } else {
            updateActive((t) => ({ ...t, cwd: next }));
          }
          break;
        }
        case "cat": {
          if (!rest[0]) return appendLines([{ kind: "err", text: "cat: missing path" }]);
          const p = resolvePath(active.cwd, rest[0]);
          const file = files.find((f) => f.path === p);
          if (!file) return appendLines([{ kind: "err", text: `cat: ${rest[0]}: no such file` }]);
          appendLines(
            file.content.split("\n").map((line) => ({ kind: "out" as const, text: line || " " })),
          );
          break;
        }
        case "open": {
          if (!rest[0]) return appendLines([{ kind: "err", text: "open: missing path" }]);
          const p = resolvePath(active.cwd, rest[0]);
          if (!files.find((f) => f.path === p))
            return appendLines([{ kind: "err", text: `open: ${rest[0]}: no such file` }]);
          onOpenFile?.(p);
          appendLines([{ kind: "ok", text: `opened ${p}` }]);
          break;
        }
        case "touch": {
          if (!rest[0]) return appendLines([{ kind: "err", text: "touch: missing path" }]);
          const p = resolvePath(active.cwd, rest[0]);
          if (files.find((f) => f.path === p))
            return appendLines([{ kind: "ok", text: `${p} exists` }]);
          await onUpsert?.(p, "");
          appendLines([{ kind: "ok", text: `+ ${p}` }]);
          break;
        }
        case "mkdir": {
          if (!rest[0]) return appendLines([{ kind: "err", text: "mkdir: missing path" }]);
          const p = resolvePath(active.cwd, rest[0]);
          await onUpsert?.(p + "/.gitkeep", "");
          appendLines([{ kind: "ok", text: `+ ${p}/` }]);
          break;
        }
        case "rm": {
          if (!rest[0]) return appendLines([{ kind: "err", text: "rm: missing path" }]);
          const p = resolvePath(active.cwd, rest[0]);
          const targets = files.filter((f) => f.path === p || f.path.startsWith(p + "/"));
          if (targets.length === 0)
            return appendLines([{ kind: "err", text: `rm: ${rest[0]}: not found` }]);
          for (const t of targets) await onDelete?.(t.path);
          appendLines([{ kind: "ok", text: `- ${targets.length} file(s)` }]);
          break;
        }
        case "mv": {
          if (!rest[0] || !rest[1])
            return appendLines([{ kind: "err", text: "mv: usage: mv <from> <to>" }]);
          const from = resolvePath(active.cwd, rest[0]);
          const to = resolvePath(active.cwd, rest[1]);
          if (!files.find((f) => f.path === from))
            return appendLines([{ kind: "err", text: `mv: ${rest[0]}: not found` }]);
          await onRename?.(from, to);
          appendLines([{ kind: "ok", text: `${from} → ${to}` }]);
          break;
        }
        case "echo": {
          const gt = rest.indexOf(">");
          if (gt === -1) {
            appendLines([{ kind: "out", text: rest.join(" ") }]);
          } else {
            const text = rest.slice(0, gt).join(" ");
            const target = rest[gt + 1];
            if (!target) return appendLines([{ kind: "err", text: "echo: missing target" }]);
            const p = resolvePath(active.cwd, target);
            await onUpsert?.(p, text);
            appendLines([{ kind: "ok", text: `wrote ${text.length} chars → ${p}` }]);
          }
          break;
        }
        case "preview":
        case "build":
          onPreviewRefresh?.();
          appendLines([{ kind: "ok", text: "✓ preview refreshed" }]);
          break;
        case "exit":
          onClose();
          break;
        default:
          appendLines([
            { kind: "err", text: `ghost: command not found: ${head}. type 'help'.` },
          ]);
      }
    } catch (e: any) {
      appendLines([{ kind: "err", text: `error: ${e?.message ?? String(e)}` }]);
    }
  }

  // ---------- Tab ops ----------
  function newTab() {
    const t = makeTab();
    setTabs((ts) => [...ts, t]);
    setActiveId(t.id);
  }
  function closeTab(id: string) {
    setTabs((ts) => {
      const next = ts.filter((t) => t.id !== id);
      if (next.length === 0) {
        const f = makeTab();
        setActiveId(f.id);
        return [f];
      }
      if (id === activeId) setActiveId(next[next.length - 1].id);
      return next;
    });
  }

  // ---------- Render ----------
  return (
    <div
      className={`flex flex-col bg-black border-t border-[color:var(--ghost-accent)]/40 ${
        fullscreen ? "fixed inset-0 z-50 border-0" : "h-64"
      }`}
      style={
        {
          // CSS var so theme color cascades
          ["--ghost-accent" as any]: theme.accent,
          fontFamily:
            "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        } as React.CSSProperties
      }
      onClick={() => inputRef.current?.focus()}
    >
      {/* Title bar */}
      <div className="flex items-center bg-[#0a0a0a] border-b border-[color:var(--ghost-accent)]/40 select-none">
        <div className="flex items-center gap-1 px-2 py-1">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
        </div>
        {/* Tabs */}
        <div className="flex-1 flex items-center gap-px overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={(e) => {
                e.stopPropagation();
                setActiveId(t.id);
              }}
              className={`group flex items-center gap-1 px-3 py-1 text-[11px] border-r border-black/40 ${
                t.id === activeId
                  ? "bg-black text-[color:var(--ghost-accent)]"
                  : "bg-[#161616] text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <span>● {t.title}</span>
              {tabs.length > 1 && (
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(t.id);
                  }}
                  className="ml-1 opacity-40 hover:opacity-100 hover:text-red-400"
                >
                  <X className="h-3 w-3" />
                </span>
              )}
            </button>
          ))}
          <button
            onClick={(e) => {
              e.stopPropagation();
              newTab();
            }}
            className="px-2 py-1 text-zinc-400 hover:text-[color:var(--ghost-accent)]"
            title="New tab"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1 px-2 relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((m) => !m);
            }}
            className="p-1 text-zinc-400 hover:text-[color:var(--ghost-accent)]"
            title="Menu"
          >
            <Menu className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setFullscreen((f) => !f);
            }}
            className="p-1 text-zinc-400 hover:text-[color:var(--ghost-accent)]"
            title="Fullscreen"
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 text-zinc-400 hover:text-red-400"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-2 top-8 z-50 w-56 rounded-md border border-[color:var(--ghost-accent)]/40 bg-[#0a0a0a] p-2 text-[11px] text-zinc-300 shadow-xl"
            >
              <div className="px-1 pb-1 text-[10px] uppercase tracking-widest text-zinc-500">
                Settings
              </div>
              <button
                onClick={() => setSound((s) => !s)}
                className="flex w-full items-center justify-between rounded px-2 py-1 hover:bg-white/5"
              >
                <span className="flex items-center gap-2">
                  {sound ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                  Keyboard sound
                </span>
                <span className="text-[color:var(--ghost-accent)]">{sound ? "on" : "off"}</span>
              </button>
              <div className="px-2 py-1">
                <label className="text-zinc-500">Font size: {fontSize}px</label>
                <input
                  type="range"
                  min={10}
                  max={18}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full accent-[color:var(--ghost-accent)]"
                />
              </div>
              <div className="px-2 py-1">
                <label className="text-zinc-500">Theme</label>
                <div className="mt-1 flex gap-1">
                  {(Object.keys(THEMES) as (keyof typeof THEMES)[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => setAccent(k)}
                      className={`flex-1 rounded px-1.5 py-1 text-[10px] capitalize ${
                        accent === k
                          ? "bg-white/10 text-[color:var(--ghost-accent)]"
                          : "text-zinc-400 hover:bg-white/5"
                      }`}
                      style={{ borderBottom: `2px solid ${THEMES[k].accent}` }}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => {
                  updateActive((t) => ({ ...t, lines: [] }));
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1 hover:bg-white/5"
              >
                <Trash2 className="h-3 w-3" /> Clear screen
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Output */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-2 whitespace-pre-wrap leading-relaxed"
        style={{ fontSize, color: theme.text, background: "#000" }}
        onClick={() => inputRef.current?.focus()}
      >
        {active.lines.map((l, i) => (
          <LineRow key={i} line={l} theme={theme} />
        ))}
        {/* Input prompt */}
        <div className="flex items-start gap-1">
          <PromptLabel cwd={active.cwd} theme={theme} />
          <input
            ref={inputRef}
            value={active.input}
            onChange={(e) => updateActive((t) => ({ ...t, input: e.target.value }))}
            onKeyDown={(e) => {
              click();
              if (e.key === "Enter") {
                const cmd = active.input;
                updateActive((t) => ({
                  ...t,
                  input: "",
                  history: cmd.trim() ? [...t.history, cmd] : t.history,
                  histIdx: -1,
                }));
                void runCommand(cmd);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (active.history.length === 0) return;
                const idx =
                  active.histIdx < 0
                    ? active.history.length - 1
                    : Math.max(0, active.histIdx - 1);
                updateActive((t) => ({ ...t, histIdx: idx, input: t.history[idx] ?? "" }));
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                if (active.histIdx < 0) return;
                const idx = active.histIdx + 1;
                if (idx >= active.history.length)
                  updateActive((t) => ({ ...t, histIdx: -1, input: "" }));
                else updateActive((t) => ({ ...t, histIdx: idx, input: t.history[idx] }));
              } else if (e.key === "l" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                updateActive((t) => ({ ...t, lines: [] }));
              }
            }}
            spellCheck={false}
            autoComplete="off"
            className="flex-1 bg-transparent outline-none caret-[color:var(--ghost-accent)]"
            style={{ color: theme.text, fontSize }}
          />
        </div>
      </div>
    </div>
  );
}

// ---------- Sub-components ----------
const THEMES = {
  kali: { accent: KALI.green, text: "#c8ffc8" },
  matrix: { accent: "#00ff66", text: "#a6ffb0" },
  cyber: { accent: "#b388ff", text: "#e0d4ff" },
  amber: { accent: "#ffb454", text: "#ffe7c2" },
} as const;

function renderPrompt(cwd: string) {
  return `┌─[ghost@spikes]─[~/${cwd}]\n└─$`;
}

function PromptLabel({ cwd, theme }: { cwd: string; theme: { accent: string } }) {
  return (
    <span className="whitespace-pre shrink-0" style={{ color: theme.accent }}>
      {`┌─[`}
      <span style={{ color: KALI.user }}>ghost@spikes</span>
      {`]─[`}
      <span style={{ color: KALI.path }}>~/{cwd}</span>
      {`]\n└─$ `}
    </span>
  );
}

function LineRow({ line, theme }: { line: Line; theme: { accent: string; text: string } }) {
  if (line.kind === "in")
    return (
      <div className="whitespace-pre" style={{ color: theme.accent }}>
        {line.text}
      </div>
    );
  if (line.kind === "err")
    return <div style={{ color: "#ff5d6c" }}>{line.text}</div>;
  if (line.kind === "ok")
    return <div style={{ color: theme.accent }}>{line.text}</div>;
  return <div style={{ color: theme.text }}>{line.text}</div>;
}

// ---------- Token parser (handles quoted strings) ----------
function tokenize(s: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === q) q = null;
      else cur += c;
    } else if (c === '"' || c === "'") q = c;
    else if (c === " " || c === "\t") {
      if (cur) {
        out.push(cur);
        cur = "";
      }
    } else cur += c;
  }
  if (cur) out.push(cur);
  return out;
}

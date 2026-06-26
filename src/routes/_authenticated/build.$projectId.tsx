import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import {
  FilePlus, FolderPlus, Trash2, Download, Upload, Play, Loader2, Sparkles,
  ArrowLeft, Smartphone, Monitor, Save, X, Wand2, Bug, Terminal as TerminalIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CodeEditor } from "@/components/ghost/CodeEditor";
import { Terminal } from "@/components/ghost/Terminal";
import { toast } from "sonner";
import {
  deleteProjectFile, listProjectFiles, renameProjectFile, upsertProjectFile, listProjects,
} from "@/lib/spikes.functions";
import { parseCodeBlocks, sanitizePath } from "@/lib/code-blocks";
import { buildPreviewDoc } from "@/lib/preview-builder";

export const Route = createFileRoute("/_authenticated/build/$projectId")({
  head: () => ({ meta: [{ title: "Project — Build Mode" }] }),
  component: ProjectWorkspace,
});

function inferLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return (
    {
      html: "html", css: "css", js: "javascript", mjs: "javascript", jsx: "javascript",
      ts: "typescript", tsx: "typescript", json: "json", md: "markdown",
      py: "python", go: "go", rs: "rust", java: "java", sql: "sql",
    }[ext] ?? "text"
  );
}

function ProjectWorkspace() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();

  const listFilesFn = useServerFn(listProjectFiles);
  const upsertFn = useServerFn(upsertProjectFile);
  const renameFileFn = useServerFn(renameProjectFile);
  const deleteFileFn = useServerFn(deleteProjectFile);
  const listProjectsFn = useServerFn(listProjects);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const all = await listProjectsFn();
      return all.find((p) => p.id === projectId) ?? null;
    },
  });

  const { data: files = [] } = useQuery({
    queryKey: ["project-files", projectId],
    queryFn: () => listFilesFn({ data: { projectId } }),
  });

  const [openPaths, setOpenPaths] = useState<string[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [previewKey, setPreviewKey] = useState(0);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalLines, setTerminalLines] = useState<string[]>([
    "Ghost Shell v1.0 — read-only project shell",
    "Type 'help' for commands",
  ]);

  // Open index.html by default
  useEffect(() => {
    if (files.length > 0 && !activePath) {
      const def = files.find((f) => f.path === "index.html") ?? files[0];
      setActivePath(def.path);
      setOpenPaths([def.path]);
    }
  }, [files, activePath]);

  function openFile(path: string) {
    if (!openPaths.includes(path)) setOpenPaths((p) => [...p, path]);
    setActivePath(path);
  }
  function closeTab(path: string) {
    setOpenPaths((p) => p.filter((x) => x !== path));
    if (activePath === path) {
      const remaining = openPaths.filter((x) => x !== path);
      setActivePath(remaining[remaining.length - 1] ?? null);
    }
  }

  const activeFile = files.find((f) => f.path === activePath);
  const activeContent = activePath
    ? drafts[activePath] ?? activeFile?.content ?? ""
    : "";
  const isDirty = activePath && drafts[activePath] !== undefined && drafts[activePath] !== activeFile?.content;

  async function save() {
    if (!activePath || !isDirty) return;
    await upsertFn({
      data: {
        projectId,
        path: activePath,
        content: drafts[activePath],
        language: inferLanguage(activePath),
      },
    });
    setDrafts((d) => {
      const { [activePath]: _, ...rest } = d;
      return rest;
    });
    qc.invalidateQueries({ queryKey: ["project-files", projectId] });
    toast.success("Saved");
  }

  // Autosave after 1.2s idle
  useEffect(() => {
    if (!activePath || !isDirty) return;
    const t = setTimeout(save, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContent]);

  // ---------- Preview ----------
  const previewSrcDoc = useMemo(() => {
    const merged = files.map((f) => ({
      path: f.path,
      content: drafts[f.path] ?? f.content,
      language: f.language,
    }));
    return buildPreviewDoc(merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, drafts, previewKey]);

  // ---------- AI generation ----------
  async function generateWithAI() {
    const prompt = aiPrompt.trim();
    if (!prompt || aiBusy) return;
    setAiBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "build",
          messages: [
            {
              id: crypto.randomUUID(),
              role: "user",
              parts: [
                {
                  type: "text",
                  text:
                    `Project: ${project?.name ?? "Untitled"} (${project?.framework ?? "static"}).\n` +
                    `Existing files: ${files.map((f) => f.path).join(", ") || "none"}.\n\n` +
                    prompt,
                },
              ],
            },
          ],
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      // Read the SSE stream and accumulate text
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const evt = JSON.parse(line.slice(5).trim());
            if (evt.type === "text-delta" && typeof evt.delta === "string") fullText += evt.delta;
          } catch {
            /* skip */
          }
        }
      }
      const { files: parsed, warnings } = parseCodeBlocks(fullText);
      for (const w of warnings) toast.message("Builder", { description: w });
      if (parsed.length === 0) {
        toast.message("AI replied with no code blocks", { description: "Try a more specific prompt." });
      } else {
        for (const f of parsed) {
          await upsertFn({
            data: { projectId, path: f.path, content: f.content, language: f.language },
          });
        }
        qc.invalidateQueries({ queryKey: ["project-files", projectId] });
        toast.success(`Generated ${parsed.length} file${parsed.length === 1 ? "" : "s"}`);
        setPreviewKey((k) => k + 1);
      }
      setAiPrompt("");
    } catch (e) {
      toast.error("AI generation failed");
      console.error(e);
    } finally {
      setAiBusy(false);
    }
  }

  // ---------- File ops ----------
  async function addFile() {
    const path = window.prompt("File path", "new.html");
    if (!path) return;
    if (files.find((f) => f.path === path)) return toast.error("File exists");
    await upsertFn({ data: { projectId, path, content: "", language: inferLanguage(path) } });
    qc.invalidateQueries({ queryKey: ["project-files", projectId] });
    openFile(path);
  }
  async function addFolder() {
    const folder = window.prompt("Folder path", "src");
    if (!folder) return;
    await upsertFn({
      data: { projectId, path: `${folder}/.gitkeep`, content: "", language: "text" },
    });
    qc.invalidateQueries({ queryKey: ["project-files", projectId] });
  }
  async function renameF(id: string, current: string) {
    const next = window.prompt("Rename file", current);
    if (!next || next === current) return;
    await renameFileFn({ data: { id, path: next } });
    qc.invalidateQueries({ queryKey: ["project-files", projectId] });
  }
  async function deleteF(id: string, path: string) {
    if (!window.confirm(`Delete ${path}?`)) return;
    await deleteFileFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["project-files", projectId] });
    closeTab(path);
  }

  // ---------- ZIP ----------
  async function exportZip() {
    const zip = new JSZip();
    for (const f of files) zip.file(f.path, drafts[f.path] ?? f.content);
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${project?.name ?? "project"}.zip`;
    a.click();
  }
  const zipInputRef = useRef<HTMLInputElement | null>(null);
  async function importZip(file: File) {
    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files).filter((e) => !e.dir);
    for (const entry of entries) {
      const content = await entry.async("string");
      await upsertFn({
        data: { projectId, path: entry.name, content, language: inferLanguage(entry.name) },
      });
    }
    qc.invalidateQueries({ queryKey: ["project-files", projectId] });
    toast.success(`Imported ${entries.length} files`);
  }

  // ---------- Drag & drop ----------
  const [dragOver, setDragOver] = useState(false);

  async function ingestDroppedItems(items: DataTransferItemList | null, fallback: FileList | null) {
    const collected: Array<{ path: string; file: File }> = [];

    async function walk(entry: FileSystemEntry, prefix: string) {
      if (entry.isFile) {
        const file: File = await new Promise((res, rej) =>
          (entry as FileSystemFileEntry).file(res, rej),
        );
        collected.push({ path: prefix + entry.name, file });
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        const all: FileSystemEntry[] = [];
        // readEntries returns batches until empty
        while (true) {
          const batch: FileSystemEntry[] = await new Promise((res, rej) =>
            reader.readEntries(res, rej),
          );
          if (batch.length === 0) break;
          all.push(...batch);
        }
        for (const child of all) await walk(child, prefix + entry.name + "/");
      }
    }

    if (items && items.length > 0 && typeof items[0].webkitGetAsEntry === "function") {
      const entries: FileSystemEntry[] = [];
      for (let i = 0; i < items.length; i++) {
        const e = items[i].webkitGetAsEntry();
        if (e) entries.push(e);
      }
      for (const e of entries) await walk(e, "");
    } else if (fallback) {
      for (let i = 0; i < fallback.length; i++) {
        const f = fallback[i];
        collected.push({ path: f.name, file: f });
      }
    }

    if (collected.length === 0) return;

    let ok = 0;
    for (const { path, file } of collected) {
      const safe = sanitizePath(path);
      if (!safe) continue;
      if (/\.zip$/i.test(safe)) {
        await importZip(file);
        continue;
      }
      const isText =
        file.type.startsWith("text/") ||
        /\.(html?|css|js|mjs|cjs|jsx|ts|tsx|json|md|txt|svg|xml|yaml|yml|py|go|rs|java|sql|sh|env)$/i.test(safe);
      let content: string;
      if (isText) {
        content = await file.text();
      } else {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = "";
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        content = `data:${file.type || "application/octet-stream"};base64,${btoa(bin)}`;
      }
      await upsertFn({
        data: { projectId, path: safe, content, language: inferLanguage(safe) },
      });
      ok++;
    }
    qc.invalidateQueries({ queryKey: ["project-files", projectId] });
    if (ok > 0) toast.success(`Added ${ok} file${ok === 1 ? "" : "s"}`);
  }



  // ---------- Terminal ----------
  function runShell(cmd: string) {
    setTerminalLines((l) => [...l, `> ${cmd}`]);
    const c = cmd.trim();
    if (c === "help") {
      setTerminalLines((l) => [
        ...l,
        "Commands: ls, cat <path>, clear, help, build, preview",
      ]);
    } else if (c === "ls") {
      setTerminalLines((l) => [...l, ...files.map((f) => f.path)]);
    } else if (c.startsWith("cat ")) {
      const p = c.slice(4).trim();
      const f = files.find((x) => x.path === p);
      setTerminalLines((l) => [...l, f ? (drafts[p] ?? f.content) : `not found: ${p}`]);
    } else if (c === "clear") {
      setTerminalLines([]);
    } else if (c === "preview" || c === "build") {
      setPreviewKey((k) => k + 1);
      setTerminalLines((l) => [...l, "✓ Preview refreshed"]);
    } else {
      setTerminalLines((l) => [...l, `unknown: ${c}`]);
    }
  }

  // ---------- Folder tree ----------
  const tree = useMemo(() => buildTree(files), [files]);

  return (
    <div className="flex h-[calc(100vh-65px)] flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border/40 glass px-4 py-2 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/build">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Projects
            </Button>
          </Link>
          <div className="truncate font-display font-bold neon-text">{project?.name ?? "Project"}</div>
          <span className="text-[10px] font-mono text-secondary uppercase">{project?.framework}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setShowTerminal((s) => !s)} className="gap-1">
            <TerminalIcon className="h-3.5 w-3.5" /> Shell
          </Button>
          <Button variant="ghost" size="sm" onClick={exportZip} className="gap-1">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <input
            ref={zipInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && importZip(e.target.files[0])}
          />
          <Button variant="ghost" size="sm" onClick={() => zipInputRef.current?.click()} className="gap-1">
            <Upload className="h-3.5 w-3.5" /> Import
          </Button>
        </div>
      </div>

      {/* Body grid */}
      <div className="grid flex-1 grid-cols-1 md:grid-cols-[220px_1fr_1fr] overflow-hidden">
        {/* Explorer */}
        <aside className="hidden md:flex flex-col border-r border-border/40 glass overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
            <span className="text-[10px] font-mono tracking-widest text-muted-foreground">EXPLORER</span>
            <div className="flex gap-1">
              <button onClick={addFile} className="p-1 hover:text-secondary" title="New file">
                <FilePlus className="h-3.5 w-3.5" />
              </button>
              <button onClick={addFolder} className="p-1 hover:text-secondary" title="New folder">
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 text-xs space-y-0.5">
            <FileTree
              nodes={tree}
              activePath={activePath}
              onOpen={openFile}
              onRename={(p) => {
                const f = files.find((x) => x.path === p);
                if (f) renameF(f.id, f.path);
              }}
              onDelete={(p) => {
                const f = files.find((x) => x.path === p);
                if (f) deleteF(f.id, f.path);
              }}
            />
          </div>
          {/* AI generator */}
          <div className="border-t border-border/40 p-2 space-y-2">
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Tell Spikes what to build…"
              rows={2}
              className="text-xs"
            />
            <Button onClick={generateWithAI} disabled={aiBusy} className="w-full gap-1 glow-purple" size="sm">
              {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              Generate
            </Button>
          </div>
        </aside>

        {/* Editor */}
        <section className="flex flex-col border-r border-border/40 overflow-hidden">
          <div className="flex items-center gap-1 border-b border-border/40 glass px-2 py-1 overflow-x-auto">
            {openPaths.map((p) => (
              <div
                key={p}
                onClick={() => setActivePath(p)}
                className={`flex items-center gap-1 cursor-pointer rounded-t-md px-3 py-1 text-xs whitespace-nowrap ${
                  activePath === p ? "bg-muted/60 text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{p}</span>
                {drafts[p] !== undefined && drafts[p] !== files.find((f) => f.path === p)?.content && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(p);
                  }}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="flex-1" />
            {activePath && (
              <Button onClick={save} size="sm" variant="ghost" disabled={!isDirty} className="gap-1">
                <Save className="h-3.5 w-3.5" /> Save
              </Button>
            )}
          </div>
          {activePath ? (
            <div className="flex-1 min-h-0 bg-[#0a0a18]">
              <CodeEditor
                value={activeContent}
                language={inferLanguage(activePath)}
                onChange={(v) => setDrafts((d) => ({ ...d, [activePath]: v }))}
                onSave={save}
              />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              <div className="text-center">
                <Sparkles className="mx-auto h-8 w-8 text-primary mb-2" />
                Select a file or generate with Spikes
              </div>
            </div>
          )}
          {showTerminal && (
            <Terminal lines={terminalLines} onRun={runShell} onClose={() => setShowTerminal(false)} />
          )}
        </section>

        {/* Live preview */}
        <section className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/40 glass px-3 py-1.5">
            <span className="text-[10px] font-mono tracking-widest text-muted-foreground">LIVE PREVIEW</span>
            <div className="flex items-center gap-1">
              <Button
                variant={device === "desktop" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setDevice("desktop")}
                title="Desktop"
              >
                <Monitor className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={device === "mobile" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setDevice("mobile")}
                title="Mobile"
              >
                <Smartphone className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setPreviewKey((k) => k + 1)} title="Reload">
                <Play className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-black/60 p-2 grid place-items-center">
            <iframe
              key={previewKey}
              srcDoc={previewSrcDoc}
              title="preview"
              sandbox="allow-scripts allow-forms"
              className={`bg-white shadow-2xl rounded-md transition-all ${
                device === "mobile" ? "w-[390px] h-[700px]" : "w-full h-full"
              }`}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------- Folder tree ----------
type TreeNode = { name: string; path: string; isFile: boolean; children: TreeNode[] };
function buildTree(files: Array<{ path: string }>): TreeNode[] {
  const root: TreeNode = { name: "", path: "", isFile: false, children: [] };
  for (const f of files) {
    const parts = f.path.split("/");
    let cur = root;
    let acc = "";
    parts.forEach((part, i) => {
      acc = acc ? `${acc}/${part}` : part;
      const isFile = i === parts.length - 1;
      let next = cur.children.find((c) => c.name === part);
      if (!next) {
        next = { name: part, path: acc, isFile, children: [] };
        cur.children.push(next);
      }
      cur = next;
    });
  }
  const sort = (n: TreeNode) => {
    n.children.sort((a, b) => Number(a.isFile) - Number(b.isFile) || a.name.localeCompare(b.name));
    n.children.forEach(sort);
  };
  sort(root);
  return root.children;
}

function FileTree({
  nodes, activePath, onOpen, onRename, onDelete, depth = 0,
}: {
  nodes: TreeNode[];
  activePath: string | null;
  onOpen: (p: string) => void;
  onRename: (p: string) => void;
  onDelete: (p: string) => void;
  depth?: number;
}) {
  return (
    <div>
      {nodes.map((n) =>
        n.isFile ? (
          <div
            key={n.path}
            onClick={() => onOpen(n.path)}
            className={`group flex items-center gap-1 rounded px-1.5 py-1 cursor-pointer ${
              activePath === n.path ? "bg-primary/20 text-foreground" : "hover:bg-muted/40 text-muted-foreground"
            }`}
            style={{ paddingLeft: depth * 10 + 6 }}
          >
            <span className="flex-1 truncate">{n.name}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onRename(n.path); }}
              className="opacity-0 group-hover:opacity-100 hover:text-secondary"
            >
              <Bug className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(n.path); }}
              className="opacity-0 group-hover:opacity-100 hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div key={n.path}>
            <div className="px-1.5 py-1 text-secondary" style={{ paddingLeft: depth * 10 + 6 }}>
              📁 {n.name}
            </div>
            <FileTree
              nodes={n.children}
              activePath={activePath}
              onOpen={onOpen}
              onRename={onRename}
              onDelete={onDelete}
              depth={depth + 1}
            />
          </div>
        ),
      )}
    </div>
  );
}


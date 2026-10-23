import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import {
  FilePlus, FolderPlus, Trash2, Download, Upload, Play, Loader2, Sparkles,
  ArrowLeft, Smartphone, Monitor, Save, X, Send, Mic, MicOff, Files as FilesIcon,
  Eye, Terminal as TerminalIcon, Code2, Hammer, Columns2, Maximize2, Minimize2, Maximize, Minimize,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CodeEditor } from "@/components/ghost/CodeEditor";
import { Terminal } from "@/components/ghost/Terminal";
import { Markdown } from "@/components/ghost/Markdown";
import { toast } from "sonner";
import {
  deleteProjectFile, listProjectFiles, renameProjectFile, upsertProjectFile, listProjects,
  getOrCreateBuildConversation, getMessages, saveMessages,
} from "@/lib/spikes.functions";
import { parseCodeBlocks, sanitizePath } from "@/lib/code-blocks";
import { buildPreviewDoc } from "@/lib/preview-builder";
import { useVoiceRecorder, preflightMic, micErrorMessage, type MicErrorKind } from "@/lib/voice-recorder";
import { BuildAccessGate } from "@/components/ghost/BuildAccessGate";
import { authedFetch } from "@/lib/api-fetch";

export const Route = createFileRoute("/_authenticated/build/$projectId")({
  head: () => ({ meta: [{ title: "Project — Build Mode" }] }),
  component: () => (
    <BuildAccessGate>
      <ProjectWorkspace />
    </BuildAccessGate>
  ),
});

type RightTab = "files" | "preview" | "terminal";

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
  const getOrCreateConvFn = useServerFn(getOrCreateBuildConversation);
  const getMessagesFn = useServerFn(getMessages);
  const saveMsgsFn = useServerFn(saveMessages);

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

  // Persistent chat tied to this project
  const { data: conversation } = useQuery({
    queryKey: ["build-conversation", projectId, project?.name],
    queryFn: () =>
      getOrCreateConvFn({ data: { projectId, projectName: project?.name ?? "Project" } }),
    enabled: !!project,
  });

  const { data: initialMessages = [] } = useQuery({
    queryKey: ["build-messages", conversation?.id],
    queryFn: () => getMessagesFn({ data: { conversationId: conversation!.id } }),
    enabled: !!conversation,
  });

  // Workspace state
  const [openPaths, setOpenPaths] = useState<string[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [previewKey, setPreviewKey] = useState(0);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [rightTab, setRightTab] = useState<RightTab>("files");
  const [split, setSplit] = useState(false);


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
    setRightTab("files");
  }
  function closeTab(path: string) {
    setOpenPaths((p) => p.filter((x) => x !== path));
    if (activePath === path) {
      const remaining = openPaths.filter((x) => x !== path);
      setActivePath(remaining[remaining.length - 1] ?? null);
    }
  }

  const activeFile = files.find((f) => f.path === activePath);
  const activeContent = activePath ? drafts[activePath] ?? activeFile?.content ?? "" : "";
  const isDirty =
    !!activePath && drafts[activePath] !== undefined && drafts[activePath] !== activeFile?.content;

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

  useEffect(() => {
    if (!activePath || !isDirty) return;
    const t = setTimeout(save, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContent]);

  const previewSrcDoc = useMemo(() => {
    const merged = files.map((f) => ({
      path: f.path,
      content: drafts[f.path] ?? f.content,
      language: f.language,
    }));
    return buildPreviewDoc(merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, drafts, previewKey]);

  // ---------- Chat (continuous Spikes Build conversation) ----------
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { mode: "build" },
        fetch: authedFetch,
      }),
    [],
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    id: conversation?.id ?? `pending-${projectId}`,
    transport,
    onError: (e) => toast.error(e.message || "Spikes hit an error"),
  });

  // Hydrate from db
  useEffect(() => {
    if (!conversation) return;
    setMessages(
      (initialMessages as Array<{ id: string; role: string; parts: unknown }>).map((m) => ({
        id: m.id,
        role: m.role as UIMessage["role"],
        parts: (m.parts as UIMessage["parts"]) ?? [],
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id, initialMessages]);

  // Autosave conversation + auto-apply code blocks from assistant replies
  const lastSavedRef = useRef<string>("");
  const lastAppliedRef = useRef<string>("");
  useEffect(() => {
    if (status !== "ready" || !conversation || messages.length === 0) return;
    const sig = JSON.stringify(messages.map((m) => [m.role, m.parts]));
    if (sig === lastSavedRef.current) return;
    lastSavedRef.current = sig;
    saveMsgsFn({
      data: {
        conversationId: conversation.id,
        messages: messages.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          parts: m.parts as unknown[],
        })),
      },
    }).catch((e) => console.error("autosave failed", e));

    // Apply code blocks from the latest assistant turn
    const last = messages[messages.length - 1];
    if (last.role !== "assistant") return;
    const text = last.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
    const applyKey = last.id + ":" + text.length;
    if (lastAppliedRef.current === applyKey) return;
    const { files: parsed } = parseCodeBlocks(text);
    if (parsed.length === 0) return;
    lastAppliedRef.current = applyKey;
    (async () => {
      for (const f of parsed) {
        await upsertFn({
          data: { projectId, path: f.path, content: f.content, language: f.language },
        });
      }
      qc.invalidateQueries({ queryKey: ["project-files", projectId] });
      toast.success(`Spikes wrote ${parsed.length} file${parsed.length === 1 ? "" : "s"}`);
      setPreviewKey((k) => k + 1);
    })().catch((e) => {
      console.error(e);
      toast.error("Couldn't apply generated files");
    });
  }, [status, messages, conversation, projectId, saveMsgsFn, upsertFn, qc]);

  // ---------- Composer ----------
  const [input, setInput] = useState("");
  const { recording, start: startRec, stop: stopRec, cancel: cancelRec } = useVoiceRecorder();
  const [micNotice, setMicNotice] = useState<{ title: string; hint: string; kind: MicErrorKind } | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const isChatLoading = status === "submitted" || status === "streaming";

  // Slash-commands: switch right-pane tab without sending
  const COMMANDS: Record<string, RightTab> = {
    "/files": "files",
    "/editor": "files",
    "/multi-file": "files",
    "/preview": "preview",
    "/run": "preview",
    "/terminal": "terminal",
    "/shell": "terminal",
  };

  async function send() {
    const text = input.trim();
    if (!text) return;
    const cmd = text.toLowerCase().split(/\s+/)[0];
    if (cmd in COMMANDS) {
      setRightTab(COMMANDS[cmd]);
      if (cmd === "/preview") setPreviewKey((k) => k + 1);
      setInput("");
      toast.message(`Opened ${COMMANDS[cmd]}`);
      return;
    }
    if (isChatLoading) return;

    // Inject lightweight project context so Spikes knows what exists
    const ctx =
      `Project: ${project?.name ?? "Untitled"} (${project?.framework ?? "static"}).\n` +
      `Files: ${files.map((f) => f.path).join(", ") || "(empty)"}.\n\n`;
    setInput("");
    await sendMessage({
      role: "user",
      parts: [{ type: "text", text: ctx + text }],
    });
  }

  async function toggleRecording() {
    if (recording) {
      const blob = await stopRec();
      if (!blob || blob.size < 2048) {
        toast.error("Recording too short");
        return;
      }
      setTranscribing(true);
      try {
        const fd = new FormData();
        fd.append("file", blob, "recording.wav");
        const res = await authedFetch("/api/transcribe", { method: "POST", body: fd });
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as { text?: string };
        if (json.text) setInput((p) => (p ? p + " " + json.text : json.text!));
      } catch (e) {
        toast.error("Transcription failed");
        console.error(e);
      } finally {
        setTranscribing(false);
      }
      return;
    }
    const pre = await preflightMic();
    if (pre) {
      setMicNotice(pre);
      toast.error(pre.title, { description: pre.hint });
      return;
    }
    try {
      await startRec();
      setMicNotice(null);
    } catch (err) {
      cancelRec();
      const m = micErrorMessage(err);
      setMicNotice(m);
      toast.error(m.title, { description: m.hint });
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

  // ---------- Terminal bridge ----------
  async function shellUpsert(path: string, content: string) {
    await upsertFn({ data: { projectId, path, content, language: inferLanguage(path) } });
    qc.invalidateQueries({ queryKey: ["project-files", projectId] });
  }
  async function shellDelete(path: string) {
    const f = files.find((x) => x.path === path);
    if (!f) return;
    await deleteFileFn({ data: { id: f.id } });
    qc.invalidateQueries({ queryKey: ["project-files", projectId] });
    closeTab(path);
  }
  async function shellRename(from: string, to: string) {
    const f = files.find((x) => x.path === from);
    if (!f) return;
    await renameFileFn({ data: { id: f.id, path: to } });
    qc.invalidateQueries({ queryKey: ["project-files", projectId] });
  }

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
          <Hammer className="h-4 w-4 text-primary" />
          <div className="truncate font-display font-bold neon-text">{project?.name ?? "Project"}</div>
          <span className="text-[10px] font-mono text-secondary uppercase">{project?.framework}</span>
        </div>
        <div className="flex items-center gap-1">
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

      {/* Body: chat-left, workspace-right */}
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[380px_1fr] overflow-hidden">
        {/* CHAT */}
        <aside className="flex flex-col border-r border-border/40 glass overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
            <Sparkles className="h-4 w-4 text-primary animate-pulse-glow" />
            <div className="text-xs font-mono tracking-widest text-muted-foreground">
              SPIKES · BUILD MODE
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
            {messages.length === 0 && !isChatLoading && (
              <div className="text-center py-12">
                <Code2 className="mx-auto h-10 w-10 text-primary mb-3 animate-pulse-glow" />
                <h3 className="font-display font-bold neon-text">Coding mode engaged</h3>
                <p className="mt-2 text-xs text-muted-foreground px-4">
                  Same Spikes — engineer persona. Ask me to build, debug, refactor, or explain code.
                  Type{" "}
                  <code className="text-secondary">/preview</code>,{" "}
                  <code className="text-secondary">/terminal</code>, or{" "}
                  <code className="text-secondary">/files</code> to switch the workspace.
                </p>
              </div>
            )}
            {messages.map((m) => (
              <ChatBubble key={m.id} message={m} />
            ))}
            {isChatLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                Spikes is building…
              </div>
            )}
          </div>
          {/* Composer */}
          <div className="border-t border-border/40 p-2 space-y-2">
            {micNotice && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs">
                <MicOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                <div className="flex-1">
                  <div className="font-semibold text-destructive">{micNotice.title}</div>
                  <div className="text-muted-foreground">{micNotice.hint}</div>
                </div>
                <button onClick={() => setMicNotice(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-1">
              <Button
                variant={recording ? "destructive" : "ghost"}
                size="icon"
                onClick={toggleRecording}
                disabled={transcribing}
                title={recording ? "Stop recording" : "Voice input"}
              >
                {transcribing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : recording ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Build, debug, or ask anything…"
                rows={1}
                className="min-h-[40px] max-h-32 resize-none flex-1 bg-input/60 text-sm"
              />
              <Button onClick={send} disabled={isChatLoading} className="glow-purple" size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-center text-muted-foreground">
              Same conversation across files · preview · terminal
            </p>
          </div>
        </aside>

        {/* WORKSPACE */}
        <section className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-1 border-b border-border/40 glass px-2 py-1">
            <TabBtn active={rightTab === "files"} onClick={() => setRightTab("files")} icon={<FilesIcon className="h-3.5 w-3.5" />} label="Files" />
            <TabBtn active={rightTab === "preview"} onClick={() => { setRightTab("preview"); setPreviewKey((k) => k + 1); }} icon={<Eye className="h-3.5 w-3.5" />} label="Preview" />
            <TabBtn active={rightTab === "terminal"} onClick={() => setRightTab("terminal")} icon={<TerminalIcon className="h-3.5 w-3.5" />} label="Terminal" />
            <div className="flex-1" />
            {rightTab === "files" && (
              <Button
                onClick={() => { setSplit((s) => !s); setPreviewKey((k) => k + 1); }}
                size="sm"
                variant={split ? "secondary" : "ghost"}
                className="gap-1"
                title="Split editor & preview"
              >
                <Columns2 className="h-3.5 w-3.5" /> Split
              </Button>
            )}
            {rightTab === "files" && activePath && (
              <Button onClick={save} size="sm" variant="ghost" disabled={!isDirty} className="gap-1">
                <Save className="h-3.5 w-3.5" /> Save
              </Button>
            )}

            {rightTab === "preview" && (
              <div className="flex items-center gap-1">
                <Button variant={device === "desktop" ? "secondary" : "ghost"} size="icon" onClick={() => setDevice("desktop")}>
                  <Monitor className="h-3.5 w-3.5" />
                </Button>
                <Button variant={device === "mobile" ? "secondary" : "ghost"} size="icon" onClick={() => setDevice("mobile")}>
                  <Smartphone className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setPreviewKey((k) => k + 1)} title="Reload">
                  <Play className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* FILES TAB */}
          {rightTab === "files" && (
            <div className="grid flex-1 grid-cols-[220px_1fr] overflow-hidden">
              <div
                className={`flex flex-col border-r border-border/40 overflow-hidden transition-colors ${
                  dragOver ? "bg-primary/10 ring-2 ring-inset ring-primary/60" : ""
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                  if (!dragOver) setDragOver(true);
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  setDragOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  void ingestDroppedItems(e.dataTransfer.items, e.dataTransfer.files);
                }}
              >
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
              </div>
              <div className="flex flex-col overflow-hidden">
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
                </div>
                {activePath ? (
                  <div className={`flex-1 min-h-0 ${split ? "grid grid-rows-2 lg:grid-rows-1 lg:grid-cols-2" : ""}`}>
                    <div className="min-h-0 bg-[#0a0a18]">
                      <CodeEditor
                        value={activeContent}
                        language={inferLanguage(activePath)}
                        onChange={(v) => setDrafts((d) => ({ ...d, [activePath]: v }))}
                        onSave={save}
                      />
                    </div>
                    {split && (
                      <div className="min-h-0 border-t lg:border-t-0 lg:border-l border-border/40 bg-black/60">
                        <iframe
                          key={`split-${previewKey}`}
                          srcDoc={previewSrcDoc}
                          title="split preview"
                          sandbox="allow-scripts allow-forms"
                          className="h-full w-full bg-white"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                    <div className="text-center">
                      <Sparkles className="mx-auto h-8 w-8 text-primary mb-2" />
                      Ask Spikes to build something — files will appear here.
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* PREVIEW TAB */}
          {rightTab === "preview" && (
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
          )}

          {/* TERMINAL TAB */}
          {rightTab === "terminal" && (
            <div className="flex-1 overflow-hidden">
              <Terminal
                files={files.map((f) => ({ path: f.path, content: drafts[f.path] ?? f.content }))}
                projectName={project?.name}
                onClose={() => setRightTab("files")}
                onUpsert={shellUpsert}
                onDelete={shellDelete}
                onRename={shellRename}
                onPreviewRefresh={() => {
                  setPreviewKey((k) => k + 1);
                  setRightTab("preview");
                }}
                onOpenFile={openFile}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function TabBtn({
  active, onClick, icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-colors ${
        active ? "bg-primary/20 text-foreground border border-primary/40" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ChatBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[92%] rounded-xl px-3 py-2 text-sm ${
          isUser ? "bg-primary text-primary-foreground" : "glass-card"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{text}</p>
        ) : (
          <Markdown>{text}</Markdown>
        )}
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
              <Code2 className="h-3 w-3" />
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

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { FolderPlus, Hammer, Trash2, Pencil, ArrowRight, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createProject, deleteProject, listProjects, renameProject, toggleProjectFavorite } from "@/lib/spikes.functions";

import { BuildAccessGate } from "@/components/ghost/BuildAccessGate";

export const Route = createFileRoute("/_authenticated/build/")({
  head: () => ({ meta: [{ title: "Build Mode — Ghost Mods Tech" }] }),
  component: () => (
    <BuildAccessGate>
      <BuildIndex />
    </BuildAccessGate>
  ),
});

function BuildIndex() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listProjects);
  const createFn = useServerFn(createProject);
  const renameFn = useServerFn(renameProject);
  const deleteFn = useServerFn(deleteProject);
  const favFn = useServerFn(toggleProjectFavorite);


  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listFn(),
  });

  const [name, setName] = useState("");
  const [framework, setFramework] = useState("static");

  async function create() {
    const n = name.trim();
    if (!n) return toast.error("Project name required");
    const row = await createFn({ data: { name: n, framework } });
    qc.invalidateQueries({ queryKey: ["projects"] });
    setName("");
    navigate({ to: "/build/$projectId", params: { projectId: row.id } });
  }

  async function rename(id: string, current: string) {
    const next = window.prompt("Rename project", current);
    if (!next || next === current) return;
    await renameFn({ data: { id, name: next } });
    qc.invalidateQueries({ queryKey: ["projects"] });
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this project and all files?")) return;
    await deleteFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["projects"] });
  }

  async function toggleFav(id: string, current: boolean) {
    await favFn({ data: { id, value: !current } });
    qc.invalidateQueries({ queryKey: ["projects"] });
  }


  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 text-center">
        <p className="text-xs font-mono tracking-[0.3em] text-secondary mb-2">// BUILD MODE</p>
        <h1 className="text-4xl font-display font-bold neon-text mb-2">
          <Hammer className="inline h-8 w-8 mr-2 -mt-1" /> Spikes Builder
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">
          Generate websites, apps, games, APIs, databases & docs. Every project autosaves and follows you across devices.
        </p>
      </div>

      <div className="glass-card rounded-xl p-5 mb-8">
        <div className="flex flex-col md:flex-row gap-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Project name (e.g. Cyber Portfolio)"
            className="flex-1"
          />
          <select
            value={framework}
            onChange={(e) => setFramework(e.target.value)}
            className="rounded-md border border-border bg-input/60 px-3 text-sm"
          >
            <option value="static">Static (HTML/CSS/JS)</option>
            <option value="react">React</option>
            <option value="api">API / Node</option>
            <option value="game">Game</option>
            <option value="docs">Documentation</option>
          </select>
          <Button onClick={create} className="glow-purple gap-2">
            <FolderPlus className="h-4 w-4" /> New Project
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-center text-sm text-muted-foreground">Loading projects…</p>
      ) : projects.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-primary mb-3 animate-pulse-glow" />
          <h3 className="text-lg font-semibold mb-1">No projects yet</h3>
          <p className="text-sm text-muted-foreground">Create your first project above to launch the editor.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <div key={p.id} className="glass-card rounded-xl p-5 hover-glow group">
              <div className="flex items-start justify-between mb-2 gap-2">
                <div className="font-display text-lg font-bold truncate flex-1">{p.name}</div>
                <div className="flex gap-1 items-center">
                  <button
                    onClick={() => toggleFav(p.id, !!(p as any).is_favorite)}
                    title={(p as any).is_favorite ? "Remove from favorites" : "Add to favorites"}
                    className={(p as any).is_favorite ? "p-1 text-secondary" : "p-1 text-muted-foreground hover:text-secondary opacity-0 group-hover:opacity-100 transition"}
                  >
                    <Star className={`h-3.5 w-3.5 ${(p as any).is_favorite ? "fill-current" : ""}`} />
                  </button>
                  <button onClick={() => rename(p.id, p.name)} className="p-1 hover:text-secondary opacity-0 group-hover:opacity-100 transition">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(p.id)} className="p-1 hover:text-destructive opacity-0 group-hover:opacity-100 transition">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-xs font-mono text-secondary mb-3">{p.framework}</p>
              <p className="text-xs text-muted-foreground mb-4">
                Updated {new Date(p.updated_at).toLocaleString()}
              </p>
              <Link to="/build/$projectId" params={{ projectId: p.id }}>
                <Button variant="outline" size="sm" className="w-full gap-2 glass">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

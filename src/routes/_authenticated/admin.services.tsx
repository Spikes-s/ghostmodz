import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Wrench, Save } from "lucide-react";
import { toast } from "sonner";
import { listServices, upsertService, deleteService } from "@/lib/tokens.functions";

export const Route = createFileRoute("/_authenticated/admin/services")({
  component: ServicesPage,
});

const EMPTY = {
  slug: "",
  title: "",
  tagline: "",
  description: "",
  body_md: "",
  icon: "",
  image_url: "",
  hero_image_url: "",
  link_type: "internal" as const,
  link_url: "",
  sort_order: 0,
  published: true,
  features: [] as any[],
  pricing: [] as any[],
  faqs: [] as any[],
};


function ServicesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listServices);
  const upsertFn = useServerFn(upsertService);
  const deleteFn = useServerFn(deleteService);
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: () => listFn() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);

  function edit(s: any) {
    setForm({ ...s });
    setOpen(true);
  }
  function add() {
    setForm({ ...EMPTY });
    setOpen(true);
  }
  async function save() {
    try {
      await upsertFn({ data: form });
      toast.success("Saved");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["services"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  }
  async function remove(id: string) {
    if (!confirm("Delete service?")) return;
    await deleteFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["services"] });
  }

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-display font-bold flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" /> Services CMS
        </h2>
        <Button onClick={add} className="glow-purple gap-2">
          <Plus className="h-4 w-4" /> Add Service
        </Button>
      </div>

      <Card className="glass-card border-border/40">
        <CardContent className="p-0">
          {services.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No services yet.</p>
          ) : (
            <div className="divide-y divide-border/40">
              {services.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 p-4">
                  <div className="text-2xl">{s.icon || "🛠️"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{s.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      /{s.slug} → {s.link_type === "external" ? s.link_url : s.link_url || `/services/${s.slug}`}
                    </div>
                  </div>
                  {!s.published && (
                    <span className="text-xs text-muted-foreground">draft</span>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => edit(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-card max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Service" : "New Service"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Slug</Label>
                <Input value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="ai-automation" />
              </div>
              <div>
                <Label>Icon (emoji)</Label>
                <Input value={form.icon || ""} onChange={(e) => set("icon", e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div>
              <Label>Tagline (small caps line above hero title)</Label>
              <Input value={form.tagline || ""} onChange={(e) => set("tagline", e.target.value)} placeholder="Agentic workflows" />
            </div>
            <div>
              <Label>Short description</Label>
              <Textarea rows={2} value={form.description || ""} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div>
              <Label>Body (Markdown)</Label>
              <Textarea rows={5} value={form.body_md || ""} onChange={(e) => set("body_md", e.target.value)} placeholder="## Overview&#10;Long-form description in markdown…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Card image URL</Label>
                <Input value={form.image_url || ""} onChange={(e) => set("image_url", e.target.value)} />
              </div>
              <div>
                <Label>Hero image URL</Label>
                <Input value={form.hero_image_url || ""} onChange={(e) => set("hero_image_url", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Link type</Label>
                <Select value={form.link_type} onValueChange={(v) => set("link_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal page</SelectItem>
                    <SelectItem value="external">External URL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sort order</Label>
                <Input type="number" value={form.sort_order ?? 0} onChange={(e) => set("sort_order", parseInt(e.target.value) || 0)} />
              </div>
            </div>
            <div>
              <Label>{form.link_type === "external" ? "External URL" : "Internal path (optional)"}</Label>
              <Input
                value={form.link_url || ""}
                onChange={(e) => set("link_url", e.target.value)}
                placeholder={form.link_type === "external" ? "https://…" : "leave blank for /services/slug"}
              />
            </div>

            <JsonField
              label="Features (JSON array of {title, description, icon})"
              value={form.features}
              onChange={(v) => set("features", v)}
              placeholder='[{"title":"24/7 uptime","description":"Autonomous agents","icon":"⚡"}]'
            />
            <JsonField
              label="Pricing tiers (JSON: {name, price, period, highlight, features:[], cta_label, cta_url})"
              value={form.pricing}
              onChange={(v) => set("pricing", v)}
              placeholder='[{"name":"Starter","price":"$49","period":"mo","features":["1 bot"],"cta_label":"Buy","cta_url":"/checkout"}]'
            />
            <JsonField
              label="FAQs (JSON array of {q, a})"
              value={form.faqs}
              onChange={(v) => set("faqs", v)}
              placeholder='[{"q":"How fast?","a":"Ships in 2 weeks."}]'
            />

            <div className="flex items-center justify-between">
              <Label>Published</Label>
              <Switch checked={!!form.published} onCheckedChange={(v) => set("published", v)} />
            </div>
            <Button onClick={save} className="glow-purple gap-2 mt-2">
              <Save className="h-4 w-4" /> Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

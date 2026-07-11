import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Save, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { getSiteSettings, updateSiteSettings } from "@/lib/tokens.functions";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const getFn = useServerFn(getSiteSettings);
  const updateFn = useServerFn(updateSiteSettings);
  const { data } = useQuery({ queryKey: ["site-settings"], queryFn: () => getFn() });

  const [form, setForm] = useState<any>({});
  useEffect(() => {
    if (data) setForm({ ...data, socials: data.socials || {} });
  }, [data]);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const setSocial = (k: string, v: string) =>
    setForm((p: any) => ({ ...p, socials: { ...(p.socials || {}), [k]: v } }));

  async function save() {
    try {
      const { id, updated_at, ...payload } = form;
      await updateFn({ data: payload });
      toast.success("Settings saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  }

  if (!data) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <Card className="glass-card border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <SettingsIcon className="h-5 w-5 text-primary" /> Website Identity
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Site name</Label>
            <Input value={form.site_name || ""} onChange={(e) => set("site_name", e.target.value)} />
          </div>
          <div>
            <Label>Logo URL</Label>
            <Input value={form.logo_url || ""} onChange={(e) => set("logo_url", e.target.value)} />
          </div>
          <div>
            <Label>Favicon URL</Label>
            <Input value={form.favicon_url || ""} onChange={(e) => set("favicon_url", e.target.value)} />
          </div>
          <div>
            <Label>Homepage banner image</Label>
            <Input
              value={form.homepage_banner || ""}
              onChange={(e) => set("homepage_banner", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={form.description || ""}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-border/40">
        <CardHeader><CardTitle className="text-lg">Homepage</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Hero title</Label>
            <Input value={form.hero_title || ""} onChange={(e) => set("hero_title", e.target.value)} />
          </div>
          <div>
            <Label>Hero subtitle</Label>
            <Textarea rows={2} value={form.hero_subtitle || ""} onChange={(e) => set("hero_subtitle", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-border/40">
        <CardHeader><CardTitle className="text-lg">Service Links</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>WhatsApp Bot URL</Label>
            <Input placeholder="https://wa.me/…" value={form.whatsapp_bot_url || ""} onChange={(e) => set("whatsapp_bot_url", e.target.value)} />
          </div>
          <div>
            <Label>Cloud Solutions URL</Label>
            <Input placeholder="https://…" value={form.cloud_solutions_url || ""} onChange={(e) => set("cloud_solutions_url", e.target.value)} />
          </div>

      <Card className="glass-card border-border/40">
        <CardHeader>
          <CardTitle className="text-lg">Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Email</Label>
            <Input
              value={form.contact_email || ""}
              onChange={(e) => set("contact_email", e.target.value)}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={form.contact_phone || ""}
              onChange={(e) => set("contact_phone", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-border/40">
        <CardHeader>
          <CardTitle className="text-lg">Social Links</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {["twitter", "github", "linkedin", "instagram", "facebook", "youtube"].map((k) => (
            <div key={k}>
              <Label className="capitalize">{k}</Label>
              <Input
                value={form.socials?.[k] || ""}
                onChange={(e) => setSocial(k, e.target.value)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="glass-card border-border/40">
        <CardHeader>
          <CardTitle className="text-lg">SEO & Footer</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div>
            <Label>SEO title</Label>
            <Input value={form.seo_title || ""} onChange={(e) => set("seo_title", e.target.value)} />
          </div>
          <div>
            <Label>SEO description</Label>
            <Textarea
              rows={2}
              value={form.seo_description || ""}
              onChange={(e) => set("seo_description", e.target.value)}
            />
          </div>
          <div>
            <Label>Footer text</Label>
            <Textarea
              rows={2}
              value={form.footer_text || ""}
              onChange={(e) => set("footer_text", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-border/40">
        <CardHeader>
          <CardTitle className="text-lg">Maintenance</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <Label>Maintenance mode</Label>
            <p className="text-xs text-muted-foreground">
              When enabled, non-admin visitors see a maintenance message.
            </p>
          </div>
          <Switch
            checked={!!form.maintenance_mode}
            onCheckedChange={(v) => set("maintenance_mode", v)}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} className="glow-purple gap-2">
          <Save className="h-4 w-4" /> Save Settings
        </Button>
      </div>
    </div>
  );
}

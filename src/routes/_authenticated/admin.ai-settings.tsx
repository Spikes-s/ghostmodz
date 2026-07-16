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
import { Bot, Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getAiSupportSettings, updateAiSupportSettings } from "@/lib/ai-support.functions";

export const Route = createFileRoute("/_authenticated/admin/ai-settings")({
  component: AiSettingsPage,
});

function AiSettingsPage() {
  const getFn = useServerFn(getAiSupportSettings);
  const saveFn = useServerFn(updateAiSupportSettings);
  const { data } = useQuery({ queryKey: ["ai-settings"], queryFn: () => getFn() });
  const [form, setForm] = useState<any>(null);

  useEffect(() => { if (data) setForm({ ...data, faqs: data.faqs || [] }); }, [data]);
  if (!form) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  async function save() {
    try {
      await saveFn({ data: {
        ai_globally_enabled: !!form.ai_globally_enabled,
        welcome_message: form.welcome_message,
        business_description: form.business_description,
        business_hours: form.business_hours,
        contact_details: form.contact_details,
        faqs: form.faqs,
        response_style: form.response_style,
        max_response_length: Number(form.max_response_length) || 400,
        supported_languages: form.supported_languages,
        escalation_rules: form.escalation_rules,
      } });
      toast.success("AI settings saved");
    } catch (e: any) { toast.error(e?.message || "Failed"); }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Card className="glass-card border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="h-5 w-5 text-accent" /> AI Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>AI reply globally enabled</Label>
              <p className="text-xs text-muted-foreground">When off, the AI never answers — only administrators do.</p>
            </div>
            <Switch checked={!!form.ai_globally_enabled} onCheckedChange={(v) => set("ai_globally_enabled", v)} />
          </div>
          <div>
            <Label>Welcome message</Label>
            <Textarea rows={2} value={form.welcome_message} onChange={(e) => set("welcome_message", e.target.value)} />
          </div>
          <div>
            <Label>Business description</Label>
            <Textarea rows={3} value={form.business_description} onChange={(e) => set("business_description", e.target.value)} />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Business hours</Label>
              <Input value={form.business_hours} onChange={(e) => set("business_hours", e.target.value)} />
            </div>
            <div>
              <Label>Contact details</Label>
              <Input value={form.contact_details} onChange={(e) => set("contact_details", e.target.value)} />
            </div>
            <div>
              <Label>Response style</Label>
              <Input value={form.response_style} onChange={(e) => set("response_style", e.target.value)} />
            </div>
            <div>
              <Label>Max response length (chars)</Label>
              <Input type="number" value={form.max_response_length} onChange={(e) => set("max_response_length", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Supported languages (comma-separated)</Label>
            <Input
              value={(form.supported_languages || []).join(", ")}
              onChange={(e) => set("supported_languages", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
            />
          </div>
          <div>
            <Label>Escalation rules</Label>
            <Textarea rows={2} value={form.escalation_rules} onChange={(e) => set("escalation_rules", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-border/40">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">FAQs</CardTitle>
          <Button size="sm" variant="outline" onClick={() => set("faqs", [...(form.faqs || []), { q: "", a: "" }])}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {(form.faqs || []).map((f: any, i: number) => (
            <div key={i} className="grid gap-2 border border-border/40 rounded-lg p-3">
              <Input placeholder="Question" value={f.q} onChange={(e) => {
                const next = [...form.faqs]; next[i] = { ...next[i], q: e.target.value }; set("faqs", next);
              }} />
              <Textarea rows={2} placeholder="Answer" value={f.a} onChange={(e) => {
                const next = [...form.faqs]; next[i] = { ...next[i], a: e.target.value }; set("faqs", next);
              }} />
              <Button size="sm" variant="ghost" className="justify-self-end text-destructive"
                onClick={() => set("faqs", form.faqs.filter((_: any, j: number) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {(!form.faqs || form.faqs.length === 0) && (
            <p className="text-sm text-muted-foreground">No FAQs yet.</p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} className="glow-purple gap-2"><Save className="h-4 w-4" /> Save</Button>
      </div>
    </div>
  );
}

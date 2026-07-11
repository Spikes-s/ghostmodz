import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { GraduationCap, Send as SendIcon } from "lucide-react";
import { submitWebsiteRequest } from "@/lib/workflow.functions";

export const Route = createFileRoute("/_authenticated/services/campus/apply")({
  head: () => ({ meta: [{ title: "Ghost Mods Tech Campus — Apply" }] }),
  component: CampusApply,
});

function CampusApply() {
  const navigate = useNavigate();
  const submitFn = useServerFn(submitWebsiteRequest);
  const [busy, setBusy] = useState(false);
  const [d, setD] = useState<Record<string, string>>({});

  async function submit() {
    if (!d.full_name || !d.email) return toast.error("Name and email are required");
    setBusy(true);
    try {
      const row = await submitFn({
        data: {
          service_kind: "campus",
          website_type: d.preferred_course || null,
          booking_type: null,
          details: d,
          features: [],
          contact_email: d.email || null,
          contact_phone: d.phone || null,
        },
      });
      toast.success("Application submitted");
      navigate({ to: "/account/requests/$id", params: { id: (row as any).id } });
    } catch (e: any) {
      toast.error(e?.message || "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-lg glass neon-border">
          <GraduationCap className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-xs font-mono tracking-[0.3em] text-primary">// CAMPUS</p>
          <h1 className="text-3xl font-bold neon-text">Ghost Mods Tech Campus</h1>
        </div>
      </div>
      <Card className="glass-card border-border/40">
        <CardHeader><CardTitle>Course application</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {[
            ["full_name", "Full name *"],
            ["email", "Email *"],
            ["phone", "Phone number"],
            ["country", "Country"],
            ["preferred_course", "Preferred course"],
            ["study_hours", "Available study hours / week"],
            ["device", "Device you own"],
            ["internet", "Internet availability"],
          ].map(([k, l]) => (
            <div key={k}>
              <Label>{l}</Label>
              <Input value={d[k] || ""} onChange={(e) => setD((p) => ({ ...p, [k]: e.target.value }))} />
            </div>
          ))}
          <div className="md:col-span-2">
            <Label>Previous experience</Label>
            <Textarea rows={3} value={d.experience || ""} onChange={(e) => setD((p) => ({ ...p, experience: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <Label>Learning goals</Label>
            <Textarea rows={3} value={d.goals || ""} onChange={(e) => setD((p) => ({ ...p, goals: e.target.value }))} />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button onClick={submit} disabled={busy} className="glow-purple gap-2">
              <SendIcon className="h-4 w-4" /> {busy ? "Submitting…" : "Apply"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

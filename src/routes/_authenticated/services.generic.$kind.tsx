import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Send as SendIcon } from "lucide-react";
import { submitWebsiteRequest } from "@/lib/workflow.functions";

export const Route = createFileRoute("/_authenticated/services/generic/$kind")({
  head: ({ params }) => ({ meta: [{ title: `${labelForKind(params.kind)} — request` }] }),
  component: GenericRequest,
});

function labelForKind(k: string) {
  return k === "ui-ux" ? "UI / UX Design"
    : k === "software" ? "Software Development"
    : k === "hosting-api" ? "Hosting & API Deployment"
    : "Service request";
}

function GenericRequest() {
  const { kind } = Route.useParams();
  const navigate = useNavigate();
  const submitFn = useServerFn(submitWebsiteRequest);
  const [busy, setBusy] = useState(false);
  const [d, setD] = useState<Record<string, string>>({});
  const [features, setFeatures] = useState("");

  const serviceKind =
    kind === "ui-ux" ? "ui_ux" as const :
    kind === "software" ? "software" as const :
    kind === "hosting-api" ? "hosting_api" as const : "ui_ux" as const;

  async function submit() {
    if (!d.summary) return toast.error("Add a project summary");
    setBusy(true);
    try {
      const row = await submitFn({
        data: {
          service_kind: serviceKind,
          website_type: null,
          booking_type: null,
          details: d,
          features: features.split(",").map((s) => s.trim()).filter(Boolean),
          contact_email: d.email || null,
          contact_phone: d.phone || null,
        },
      });
      toast.success("Request submitted");
      navigate({ to: "/account/requests/$id", params: { id: (row as any).id } });
    } catch (e: any) {
      toast.error(e?.message || "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <p className="text-xs font-mono tracking-[0.3em] text-primary mb-2">// {kind.toUpperCase()}</p>
      <h1 className="text-3xl md:text-4xl font-bold neon-text mb-6">{labelForKind(kind)}</h1>
      <Card className="glass-card border-border/40">
        <CardHeader><CardTitle>Tell us about your project</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div>
            <Label>Project summary *</Label>
            <Textarea rows={3} value={d.summary || ""} onChange={(e) => setD((p) => ({ ...p, summary: e.target.value }))} />
          </div>
          {kind === "ui-ux" && (
            <>
              <Field label="Platform (web, mobile, both)" k="platform" d={d} setD={setD} />
              <Field label="Style / vibe" k="style" d={d} setD={setD} />
              <Field label="Colour palette" k="palette" d={d} setD={setD} />
              <Field label="Target audience" k="audience" d={d} setD={setD} />
              <Field label="Inspiration links" k="inspiration" d={d} setD={setD} />
              <Field label="Required screens" k="screens" d={d} setD={setD} />
            </>
          )}
          {kind === "software" && (
            <>
              <Field label="Software type (desktop / mobile / web / cross-platform)" k="type" d={d} setD={setD} />
              <Field label="Preferred language" k="language" d={d} setD={setD} />
              <Field label="Number of users" k="users" d={d} setD={setD} />
              <Field label="Offline support?" k="offline" d={d} setD={setD} />
              <Field label="Integrations" k="integrations" d={d} setD={setD} />
            </>
          )}
          {kind === "hosting-api" && (
            <>
              <Field label="Requested (domain, hosting, VPS, cloud, API, DB, SSL, CDN, email)" k="requested" d={d} setD={setD} />
              <Field label="Expected traffic" k="traffic" d={d} setD={setD} />
              <Field label="Region" k="region" d={d} setD={setD} />
            </>
          )}
          <Field label="Deadline / timeline" k="timeline" d={d} setD={setD} />
          <div>
            <Label>Key features (comma separated)</Label>
            <Input value={features} onChange={(e) => setFeatures(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Email" k="email" d={d} setD={setD} />
            <Field label="Phone" k="phone" d={d} setD={setD} />
          </div>
          <div className="flex justify-end">
            <Button onClick={submit} disabled={busy} className="glow-purple gap-2">
              <SendIcon className="h-4 w-4" /> {busy ? "Submitting…" : "Submit"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label, k, d, setD,
}: { label: string; k: string; d: Record<string, string>; setD: (fn: (p: Record<string, string>) => Record<string, string>) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={d[k] || ""} onChange={(e) => setD((p) => ({ ...p, [k]: e.target.value }))} />
    </div>
  );
}

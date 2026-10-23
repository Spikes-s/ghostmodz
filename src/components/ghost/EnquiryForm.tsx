import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitEnquiry } from "@/lib/enquiries.functions";
import { toast } from "sonner";

export const ENQUIRY_SERVICES = [
  { slug: "web-development", label: "Custom Web Development" },
  { slug: "whatsapp-bots", label: "WhatsApp Bot Development" },
  { slug: "telegram-bots", label: "Telegram Bot Development" },
  { slug: "ai-automation", label: "AI Automation" },
  { slug: "ui-ux", label: "UI / UX Design" },
  { slug: "software-development", label: "Software Development" },
  { slug: "coding-courses", label: "Coding Courses" },
  { slug: "ethical-hacking", label: "Ethical Hacking Courses" },
  { slug: "cloud-hosting", label: "Cloud Solutions" },
  { slug: "cybersecurity", label: "Cybersecurity Consulting" },
  { slug: "api-dev", label: "API Development" },
  { slug: "hosting-deployment", label: "Hosting & Deployment" },
  { slug: "other", label: "Something else" },
];

export function EnquiryForm({ defaultService }: { defaultService?: string }) {
  const submitFn = useServerFn(submitEnquiry);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    service: defaultService ?? "",
    message: "",
    website: "", // honeypot
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      await submitFn({
        data: {
          name: form.name,
          email: form.email,
          phone: form.phone,
          serviceSlug: form.service,
          message: form.message,
          website: form.website,
        },
      });
      setSent(true);
      toast.success("Enquiry sent — we'll reply to your email shortly.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="glass-card rounded-2xl p-10 text-center max-w-xl mx-auto">
        <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-4 animate-pulse-glow" />
        <h3 className="text-2xl font-bold neon-text mb-2">Enquiry received</h3>
        <p className="text-sm text-muted-foreground">
          Thank you, {form.name.split(" ")[0] || "friend"}. Spikes and the team will review your brief
          and reply to <span className="text-foreground">{form.email}</span> shortly.
        </p>
        <Button
          variant="outline"
          className="glass mt-6"
          onClick={() => {
            setSent(false);
            setForm((f) => ({ ...f, name: "", email: "", phone: "", message: "" }));
          }}
        >
          Send another enquiry
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 md:p-8 max-w-xl mx-auto space-y-4">
      {/* Honeypot — hidden from humans */}
      <input
        type="text"
        name="website"
        value={form.website}
        onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="enq-name" className="text-xs font-mono tracking-wider text-muted-foreground">
            YOUR NAME *
          </label>
          <Input
            id="enq-name"
            required
            maxLength={120}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Jane Wanjiku"
            className="bg-input/60"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="enq-email" className="text-xs font-mono tracking-wider text-muted-foreground">
            EMAIL *
          </label>
          <Input
            id="enq-email"
            type="email"
            required
            maxLength={200}
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="you@company.com"
            className="bg-input/60"
          />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="enq-phone" className="text-xs font-mono tracking-wider text-muted-foreground">
            PHONE / WHATSAPP (OPTIONAL)
          </label>
          <Input
            id="enq-phone"
            type="tel"
            maxLength={60}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+254 …"
            className="bg-input/60"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="enq-service" className="text-xs font-mono tracking-wider text-muted-foreground">
            SERVICE
          </label>
          <select
            id="enq-service"
            value={form.service}
            onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))}
            className="w-full h-9 rounded-md border border-input bg-input/60 px-3 text-sm text-foreground"
          >
            <option value="">Select a service…</option>
            {ENQUIRY_SERVICES.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="enq-message" className="text-xs font-mono tracking-wider text-muted-foreground">
          PROJECT BRIEF *
        </label>
        <Textarea
          id="enq-message"
          required
          rows={4}
          maxLength={2000}
          value={form.message}
          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          placeholder="Tell us what you want to build, your timeline, and your budget range…"
          className="bg-input/60 resize-none"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" size="lg" disabled={sending} className="glow-purple gap-2 w-full sm:w-auto">
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {sending ? "Sending…" : "Send enquiry"}
      </Button>
    </form>
  );
}

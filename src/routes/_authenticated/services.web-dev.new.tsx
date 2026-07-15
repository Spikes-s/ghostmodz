import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, Send as SendIcon, Sparkles } from "lucide-react";
import { submitWebsiteRequest } from "@/lib/workflow.functions";

export const Route = createFileRoute("/_authenticated/services/web-dev/new")({
  head: () => ({ meta: [{ title: "New website request — Ghost Mods Tech" }] }),
  component: NewWebRequest,
});

const WEBSITE_TYPES = [
  "Business Website", "E-commerce Website", "Portfolio Website", "School Website",
  "Hospital Website", "Church Website", "Restaurant Website", "Real Estate Website",
  "News Website", "Blog", "Membership Website", "Community Website",
  "Booking Website", "Landing Page", "SaaS Platform", "Other",
];
const BOOKING_TYPES = [
  "Hotel Booking", "Airbnb Booking", "Car Rental Booking", "Taxi/Cab Booking",
  "Bus Booking", "Flight Booking", "Event Booking", "Appointment Booking",
  "Tour Booking", "Restaurant Reservation", "Salon Booking",
  "Medical Appointment Booking", "Other",
];
const FEATURES = [
  "User accounts", "Admin dashboard", "Online payments", "M-Pesa integration",
  "Shopping cart", "Wishlist", "Reviews", "Live chat", "AI chatbot", "Notifications",
  "Email system", "Inventory management", "Booking calendar", "Analytics", "Coupons",
  "Multi-language support", "SEO", "Blog", "Mobile responsive", "Dark mode",
];

type Step = 1 | 2 | 3 | 4;

function NewWebRequest() {
  const navigate = useNavigate();
  const submitFn = useServerFn(submitWebsiteRequest);
  const [step, setStep] = useState<Step>(1);
  const [websiteType, setWebsiteType] = useState<string>("");
  const [otherWebsiteType, setOtherWebsiteType] = useState("");
  const [bookingType, setBookingType] = useState<string>("");
  const [otherBookingType, setOtherBookingType] = useState("");
  const [gen, setGen] = useState<Record<string, string>>({});
  const [features, setFeatures] = useState<Set<string>>(new Set());
  const [customRequest, setCustomRequest] = useState("");
  const [busy, setBusy] = useState(false);

  const resolvedWebsiteType = websiteType === "Other" ? otherWebsiteType : websiteType;
  const resolvedBookingType = bookingType === "Other" ? otherBookingType : bookingType;

  function toggleFeature(f: string) {
    setFeatures((prev) => {
      const n = new Set(prev);
      if (n.has(f)) n.delete(f);
      else n.add(f);
      return n;
    });
  }

  function goNext() {
    setStep((s) => Math.min(4, (s + 1) as Step) as Step);
  }
  function pickWebsiteType(t: string) {
    setWebsiteType(t);
    // Auto-advance for straightforward picks. Branching options need extra input first.
    if (t !== "Other" && t !== "Booking Website") {
      setTimeout(goNext, 180);
    }
  }
  function pickBookingType(b: string) {
    setBookingType(b);
    if (b !== "Other") setTimeout(goNext, 180);
  }
  function next() {
    if (step === 1 && !resolvedWebsiteType) return toast.error("Pick a website type");
    if (step === 1 && websiteType === "Booking Website" && !resolvedBookingType)
      return toast.error("Pick a booking type");
    if (step === 2 && !gen.website_name) return toast.error("Add a website name");
    goNext();
  }
  function prev() {
    setStep((s) => Math.max(1, (s - 1) as Step) as Step);
  }

  async function submit() {
    setBusy(true);
    try {
      const featuresArr = Array.from(features);
      if (customRequest.trim()) featuresArr.push(`Custom: ${customRequest.trim()}`);
      const row = await submitFn({
        data: {
          service_kind: "web",
          website_type: resolvedWebsiteType,
          booking_type: resolvedBookingType || null,
          details: gen,
          features: featuresArr,
          contact_email: gen.email || null,
          contact_phone: gen.phone || null,
        },
      });
      toast.success("Request submitted", { description: "Our team will send you a quote shortly." });
      navigate({ to: "/account/requests/$id", params: { id: (row as any).id } });
    } catch (e: any) {
      toast.error(e?.message || "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs font-mono tracking-[0.3em] text-primary mb-2">// WEB DEVELOPMENT</p>
          <h1 className="text-3xl md:text-4xl font-bold neon-text">Website Requirements</h1>
        </div>
        <div className="text-sm text-muted-foreground">Step {step} / 4</div>
      </div>

      <div className="mb-8 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${(step / 4) * 100}%` }}
        />
      </div>

      {step === 1 && (
        <Card className="glass-card border-border/40">
          <CardHeader><CardTitle>What kind of website do you need?</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {WEBSITE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => pickWebsiteType(t)}
                  className={`text-sm rounded-lg px-3 py-3 text-left transition-all ${
                    websiteType === t
                      ? "border border-primary bg-primary/10 text-primary neon-border"
                      : "border border-border/40 hover:border-primary/60"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {websiteType === "Other" && (
              <div>
                <Label>Describe the website type</Label>
                <Input value={otherWebsiteType} onChange={(e) => setOtherWebsiteType(e.target.value)} />
              </div>
            )}
            {websiteType === "Booking Website" && (
              <div className="space-y-2 pt-2 border-t border-border/40">
                <Label>What type of booking?</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {BOOKING_TYPES.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => pickBookingType(b)}
                      className={`text-sm rounded-lg px-3 py-2 text-left transition-all ${
                        bookingType === b
                          ? "border border-secondary bg-secondary/10 text-secondary"
                          : "border border-border/40 hover:border-secondary/60"
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
                {bookingType === "Other" && (
                  <Input
                    className="mt-2"
                    placeholder="Describe the booking type"
                    value={otherBookingType}
                    onChange={(e) => setOtherBookingType(e.target.value)}
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="glass-card border-border/40">
          <CardHeader><CardTitle>Tell us about the business</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {[
              ["website_name", "Website name *"],
              ["company_name", "Company name"],
              ["country", "Country"],
              ["county", "County / State"],
              ["city", "City"],
              ["location", "Physical location"],
              ["maps_url", "Google Maps link"],
              ["hours", "Working hours"],
              ["phone", "Contact phone"],
              ["email", "Email"],
              ["whatsapp", "WhatsApp number"],
              ["colors", "Preferred colours"],
              ["logo_url", "Existing logo URL"],
            ].map(([key, label]) => (
              <div key={key} className={key === "location" || key === "hours" ? "md:col-span-2" : ""}>
                <Label>{label}</Label>
                <Input
                  value={gen[key] || ""}
                  onChange={(e) => setGen((p) => ({ ...p, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="md:col-span-2">
              <Label>Business description</Label>
              <Textarea
                rows={3}
                value={gen.description || ""}
                onChange={(e) => setGen((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                ["need_logo", "Need a new logo?"],
                ["has_domain", "Domain already owned?"],
                ["has_hosting", "Hosting already available?"],
              ].map(([k, label]) => (
                <div key={k}>
                  <Label className="mb-2 block">{label}</Label>
                  <RadioGroup
                    value={gen[k] || ""}
                    onValueChange={(v) => setGen((p) => ({ ...p, [k]: v }))}
                    className="flex gap-4"
                  >
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem value="yes" id={`${k}-y`} /><Label htmlFor={`${k}-y`}>Yes</Label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem value="no" id={`${k}-n`} /><Label htmlFor={`${k}-n`}>No</Label>
                    </div>
                  </RadioGroup>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="glass-card border-border/40">
          <CardHeader><CardTitle>Which features do you need?</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FEATURES.map((f) => (
                <label
                  key={f}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer border transition-colors ${
                    features.has(f) ? "border-primary bg-primary/10" : "border-border/40 hover:border-primary/60"
                  }`}
                >
                  <Checkbox checked={features.has(f)} onCheckedChange={() => toggleFeature(f)} />
                  {f}
                </label>
              ))}
            </div>
            <div>
              <Label>Custom request</Label>
              <Textarea
                rows={3}
                placeholder="Anything specific we should know?"
                value={customRequest}
                onChange={(e) => setCustomRequest(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card className="glass-card border-border/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Review & submit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SummaryRow label="Website type" value={resolvedWebsiteType || "—"} />
            {resolvedBookingType && <SummaryRow label="Booking type" value={resolvedBookingType} />}
            <SummaryRow label="Website name" value={gen.website_name || "—"} />
            <SummaryRow label="Company" value={gen.company_name || "—"} />
            <SummaryRow label="Contact" value={[gen.email, gen.phone].filter(Boolean).join(" · ") || "—"} />
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">Features</p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(features).map((f) => (
                  <span key={f} className="text-xs rounded-full glass px-2.5 py-1">{f}</span>
                ))}
                {customRequest && <span className="text-xs rounded-full bg-primary/20 px-2.5 py-1">Custom: {customRequest}</span>}
                {features.size === 0 && !customRequest && <span className="text-xs text-muted-foreground">None selected</span>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 flex justify-between">
        <Button variant="ghost" onClick={prev} disabled={step === 1} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        {step === 1 ? (
          <span className="text-xs text-muted-foreground self-center">Select an option to continue…</span>
        ) : step < 4 ? (
          <Button onClick={next} className="glow-purple gap-1">
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={busy} className="glow-purple gap-2">
            <SendIcon className="h-4 w-4" /> {busy ? "Submitting…" : "Submit request"}
          </Button>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <div className="text-muted-foreground uppercase tracking-widest text-xs">{label}</div>
      <div className="col-span-2 text-foreground">{value}</div>
    </div>
  );
}

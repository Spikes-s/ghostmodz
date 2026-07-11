import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { CreditCard, Lock, ShieldCheck } from "lucide-react";
import { getQuoteByToken, submitPaymentByToken } from "@/lib/workflow.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/pay/$token")({
  head: () => ({ meta: [{ title: "Complete payment — Ghost Mods Tech" }] }),
  component: PayPage,
});

function PayPage() {
  const { token } = Route.useParams();
  const fn = useServerFn(getQuoteByToken);
  const payFn = useServerFn(submitPaymentByToken);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["quote", token],
    queryFn: () => fn({ data: { token } }),
  });
  const [method, setMethod] = useState<"mpesa" | "bank" | "manual" | "card">("mpesa");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<any>(null);

  useState;
  // hydrate session once
  // eslint-disable-next-line react-hooks/rules-of-hooks
  (function useSessionOnce() {
    // no-op stub to keep hooks order; real hydrate below
  })();

  if (isLoading) return <Center>Loading quote…</Center>;
  if (!data) return <Center>This link is invalid or has expired.</Center>;

  const q = data as any;
  const amount = Number(q.estimated_price);
  const deposit = q.deposit_percent ? +(amount * (q.deposit_percent / 100)).toFixed(2) : amount;
  const paid = q.payments?.some((p: any) => p.status === "confirmed");
  const pending = q.payments?.some((p: any) => p.status === "pending_confirmation");

  async function submit() {
    if (!session) {
      toast.error("Please sign in first");
      window.location.assign(`/auth?redirect=/pay/${token}`);
      return;
    }
    setBusy(true);
    try {
      await payFn({ data: { token, method, reference: reference || null, amount: deposit } });
      toast.success("Payment recorded", { description: "We'll confirm shortly." });
      setReference("");
      refetch();
    } catch (e: any) {
      toast.error(e?.message || "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-lg glass neon-border">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-xs font-mono tracking-[0.3em] text-primary">// SECURE PAYMENT</p>
            <h1 className="text-3xl font-bold neon-text">Complete your payment</h1>
          </div>
        </div>

        <Card className="glass-card border-primary/40 mb-6">
          <CardHeader><CardTitle>Project summary</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Row label="Service" value={q.website_type || q.service_kind.replace("_", " ")} />
            {q.booking_type && <Row label="Booking type" value={q.booking_type} />}
            <Row label="Delivery" value={`${q.estimated_days} days`} />
            <Row label="Deposit" value={`${q.deposit_percent}%`} />
            <div className="pt-3 border-t border-border/40">
              <Row label="Total" value={`${q.currency} ${amount.toLocaleString()}`} big />
              <Row label="Deposit due" value={`${q.currency} ${deposit.toLocaleString()}`} big highlight />
            </div>
            {q.admin_notes && (
              <div className="rounded-lg glass p-3 text-sm whitespace-pre-wrap mt-2">{q.admin_notes}</div>
            )}
          </CardContent>
        </Card>

        {paid ? (
          <Card className="glass-card border-green-500/60">
            <CardContent className="p-6 text-green-400 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Payment confirmed. Our team is in motion.
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card border-border/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Payment method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pending && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/40 p-3 text-sm text-amber-300">
                  A previous payment is pending admin confirmation.
                </div>
              )}
              <RadioGroup value={method} onValueChange={(v) => setMethod(v as any)} className="grid grid-cols-2 gap-2">
                {[
                  ["mpesa", "M-Pesa"],
                  ["bank", "Bank transfer"],
                  ["card", "Card"],
                  ["manual", "Other"],
                ].map(([v, l]) => (
                  <label
                    key={v}
                    className={`flex items-center gap-2 rounded-lg px-3 py-3 cursor-pointer border transition-colors ${
                      method === v ? "border-primary bg-primary/10" : "border-border/40 hover:border-primary/60"
                    }`}
                  >
                    <RadioGroupItem value={v} /> {l}
                  </label>
                ))}
              </RadioGroup>
              <div>
                <Label>Reference (M-Pesa code, transfer ref, etc.)</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
              </div>
              <Button onClick={submit} disabled={busy} className="w-full glow-purple gap-2">
                <Lock className="h-4 w-4" /> {busy ? "Submitting…" : `Mark ${q.currency} ${deposit.toLocaleString()} as paid`}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                An administrator will confirm your payment and notify you.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, big, highlight }: { label: string; value: string; big?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex justify-between items-baseline ${big ? "text-lg" : "text-sm"}`}>
      <span className="text-muted-foreground uppercase tracking-widest text-xs">{label}</span>
      <span className={`font-medium ${highlight ? "text-primary text-2xl font-bold" : ""}`}>{value}</span>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background grid place-items-center px-6">
      <div className="glass-card rounded-2xl p-10 text-center text-muted-foreground">{children}</div>
    </div>
  );
}

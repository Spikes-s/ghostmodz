import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard } from "lucide-react";
import { getMyRequest } from "@/lib/workflow.functions";
import { StatusBadge } from "./account.requests.index";

export const Route = createFileRoute("/_authenticated/account/requests/$id")({
  head: () => ({ meta: [{ title: "Request details — Ghost Mods Tech" }] }),
  component: RequestDetail,
});

function RequestDetail() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getMyRequest);
  const { data, isLoading } = useQuery({
    queryKey: ["my-request", id],
    queryFn: () => getFn({ data: { id } }),
  });

  if (isLoading) return <div className="p-10 text-muted-foreground">Loading…</div>;
  if (!data) return <div className="p-10 text-muted-foreground">Request not found.</div>;

  const r = data as any;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link to="/account/requests" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All requests
      </Link>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-3xl font-bold neon-text">{r.website_type || r.service_kind.replace("_", " ")}</h1>
        <StatusBadge status={r.status} />
      </div>

      {r.status === "quoted" && r.quote_token && (
        <Card className="glass-card border-primary/60 mb-6">
          <CardHeader>
            <CardTitle className="text-primary flex items-center gap-2">
              <CreditCard className="h-5 w-5" /> Quote ready
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-3xl font-bold">{r.currency} {Number(r.estimated_price).toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">
              Estimated delivery: {r.estimated_days} days · Deposit: {r.deposit_percent}%
            </div>
            {r.admin_notes && (
              <div className="rounded-lg glass p-3 text-sm whitespace-pre-wrap">{r.admin_notes}</div>
            )}
            <Button asChild className="glow-purple gap-2">
              <a href={`/pay/${r.quote_token}`}>
                <CreditCard className="h-4 w-4" /> Proceed to payment
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="glass-card border-border/40 mb-6">
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {r.booking_type && <Row label="Booking type" value={r.booking_type} />}
          {Object.entries(r.details || {}).map(([k, v]) => (
            <Row key={k} label={k.replace(/_/g, " ")} value={String(v)} />
          ))}
        </CardContent>
      </Card>

      <Card className="glass-card border-border/40">
        <CardHeader><CardTitle>Features</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {(r.features || []).length === 0 && <span className="text-sm text-muted-foreground">None</span>}
          {(r.features || []).map((f: string) => (
            <span key={f} className="text-xs rounded-full glass px-2.5 py-1">{f}</span>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="text-muted-foreground uppercase tracking-widest text-xs">{label}</div>
      <div className="col-span-2">{value}</div>
    </div>
  );
}

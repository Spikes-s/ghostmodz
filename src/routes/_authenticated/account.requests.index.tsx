import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Inbox, ArrowRight } from "lucide-react";
import { listMyRequests } from "@/lib/workflow.functions";

export const Route = createFileRoute("/_authenticated/account/requests/")({
  head: () => ({ meta: [{ title: "My requests — Ghost Mods Tech" }] }),
  component: MyRequests,
});

function MyRequests() {
  const listFn = useServerFn(listMyRequests);
  const { data = [], isLoading } = useQuery({ queryKey: ["my-requests"], queryFn: () => listFn() });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <Inbox className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold neon-text">My Requests</h1>
      </div>
      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {!isLoading && data.length === 0 && (
        <Card className="glass-card border-border/40">
          <CardContent className="p-10 text-center text-muted-foreground">
            No requests yet. <Link to="/" className="text-primary underline">Start one</Link>.
          </CardContent>
        </Card>
      )}
      <div className="grid gap-3">
        {(data as any[]).map((r) => (
          <Link
            key={r.id}
            to="/account/requests/$id"
            params={{ id: r.id }}
            className="glass-card rounded-xl p-5 flex items-center justify-between hover-glow"
          >
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{r.website_type || r.service_kind.replace("_", " ")}</span>
                {r.booking_type && <span className="text-xs text-muted-foreground">· {r.booking_type}</span>}
                <StatusBadge status={r.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(r.created_at).toLocaleString()}
                {r.estimated_price && ` · Quoted ${r.currency} ${Number(r.estimated_price).toLocaleString()}`}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-primary" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    submitted: "bg-muted text-foreground",
    quoted: "bg-primary/20 text-primary border-primary/40",
    approved: "bg-green-500/20 text-green-400 border-green-500/40",
    rejected: "bg-red-500/20 text-red-400 border-red-500/40",
    info_requested: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    in_progress: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
    completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
  };
  return (
    <Badge variant="outline" className={`text-[10px] uppercase tracking-widest ${map[status] || ""}`}>
      {status.replace("_", " ")}
    </Badge>
  );
}

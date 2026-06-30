import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Inbox, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  listTokenRequests,
  approveTokenRequest,
  denyTokenRequest,
} from "@/lib/tokens.functions";

export const Route = createFileRoute("/_authenticated/admin/requests")({
  component: RequestsPage,
});

function RequestsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTokenRequests);
  const approveFn = useServerFn(approveTokenRequest);
  const denyFn = useServerFn(denyTokenRequest);

  const { data: requests = [] } = useQuery({
    queryKey: ["token-requests"],
    queryFn: () => listFn(),
  });

  async function approve(id: string) {
    try {
      const { token } = await approveFn({ data: { id } });
      await navigator.clipboard.writeText(token).catch(() => {});
      toast.success(`Token generated & copied: ${token}`);
      qc.invalidateQueries({ queryKey: ["token-requests"] });
      qc.invalidateQueries({ queryKey: ["access-tokens"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  }

  async function deny(id: string) {
    await denyFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["token-requests"] });
  }

  return (
    <Card className="glass-card border-border/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Inbox className="h-5 w-5 text-primary" /> Token Requests
        </CardTitle>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests.</p>
        ) : (
          <div className="divide-y divide-border/40">
            {requests.map((r: any) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {r.profile?.username || r.profile?.email || r.user_id.slice(0, 8)}
                  </div>
                  {r.reason && (
                    <div className="text-xs text-muted-foreground italic mt-0.5">
                      "{r.reason}"
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    r.status === "approved"
                      ? "text-green-400"
                      : r.status === "denied"
                        ? "text-destructive"
                        : "text-secondary"
                  }
                >
                  {r.status}
                </Badge>
                {r.status === "pending" && (
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => approve(r.id)} className="gap-1">
                      <Check className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deny(r.id)}>
                      <X className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

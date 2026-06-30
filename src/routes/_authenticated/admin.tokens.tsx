import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Plus, Trash2, Ban, KeyRound, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  listAccessTokens,
  createAccessToken,
  revokeAccessToken,
  deleteAccessToken,
} from "@/lib/tokens.functions";

export const Route = createFileRoute("/_authenticated/admin/tokens")({
  component: TokensPage,
});

function statusOf(t: any) {
  if (t.revoked) return { label: "revoked", color: "text-destructive", Icon: Ban };
  if (t.consumed_at) return { label: "used", color: "text-muted-foreground", Icon: CheckCircle2 };
  if (t.expires_at && new Date(t.expires_at) < new Date())
    return { label: "expired", color: "text-destructive", Icon: XCircle };
  return { label: "active", color: "text-green-400", Icon: Clock };
}

function TokensPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAccessTokens);
  const createFn = useServerFn(createAccessToken);
  const revokeFn = useServerFn(revokeAccessToken);
  const deleteFn = useServerFn(deleteAccessToken);

  const { data: tokens = [] } = useQuery({
    queryKey: ["access-tokens"],
    queryFn: () => listFn(),
  });

  const [custom, setCustom] = useState("");
  const [label, setLabel] = useState("");
  const [expires, setExpires] = useState("");

  async function generate() {
    try {
      const row = await createFn({
        data: {
          custom: custom.trim() || undefined,
          label: label.trim() || undefined,
          expiresAt: expires ? new Date(expires).toISOString() : null,
        },
      });
      await navigator.clipboard.writeText(row.token).catch(() => {});
      toast.success("Token created & copied");
      setCustom("");
      setLabel("");
      setExpires("");
      qc.invalidateQueries({ queryKey: ["access-tokens"] });
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  }

  async function copy(t: string) {
    await navigator.clipboard.writeText(t).catch(() => {});
    toast.success("Copied");
  }

  return (
    <div className="space-y-6">
      <Card className="glass-card border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-5 w-5 text-primary" /> Generate Access Token
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Input
            placeholder="Custom token (optional)"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="font-mono"
          />
          <Input
            placeholder="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Input
            type="datetime-local"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
          />
          <Button onClick={generate} className="glow-purple gap-2">
            <Plus className="h-4 w-4" /> Create
          </Button>
        </CardContent>
      </Card>

      <Card className="glass-card border-border/40">
        <CardHeader>
          <CardTitle className="text-lg">All Tokens ({tokens.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tokens yet.</p>
          ) : (
            <div className="divide-y divide-border/40">
              {tokens.map((t: any) => {
                const s = statusOf(t);
                return (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-primary truncate">{t.token}</div>
                      <div className="text-xs text-muted-foreground flex gap-3 flex-wrap mt-0.5">
                        {t.label && <span>{t.label}</span>}
                        <span>created {new Date(t.created_at).toLocaleString()}</span>
                        {t.expires_at && (
                          <span>expires {new Date(t.expires_at).toLocaleString()}</span>
                        )}
                        {t.consumed_at && (
                          <span>used {new Date(t.consumed_at).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={`gap-1 ${s.color}`}>
                      <s.Icon className="h-3 w-3" /> {s.label}
                    </Badge>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => copy(t.token)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      {!t.revoked && !t.consumed_at && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            await revokeFn({ data: { id: t.id } });
                            qc.invalidateQueries({ queryKey: ["access-tokens"] });
                          }}
                        >
                          <Ban className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          if (!confirm("Delete token?")) return;
                          await deleteFn({ data: { id: t.id } });
                          qc.invalidateQueries({ queryKey: ["access-tokens"] });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

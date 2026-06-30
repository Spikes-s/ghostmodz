import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Key, Loader2, Clipboard, ArrowRight, ShieldCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  isPrimaryAdmin,
  redeemAccessToken,
  requestAccessToken,
  listMyRequests,
} from "@/lib/tokens.functions";
import { hasBuildAccess, grantBuildAccess } from "@/lib/build-access";

export function BuildAccessGate({ children }: { children: ReactNode }) {
  const isPrimaryFn = useServerFn(isPrimaryAdmin);
  const redeemFn = useServerFn(redeemAccessToken);
  const requestFn = useServerFn(requestAccessToken);
  const listMineFn = useServerFn(listMyRequests);

  const { data: primary, isLoading } = useQuery({
    queryKey: ["primary-admin"],
    queryFn: () => isPrimaryFn(),
    staleTime: 60_000,
  });

  const [tick, setTick] = useState(0);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [showRequest, setShowRequest] = useState(false);

  const { data: myRequests = [], refetch } = useQuery({
    queryKey: ["my-token-requests"],
    queryFn: () => listMineFn(),
    enabled: showRequest,
  });

  if (isLoading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (primary?.primary || hasBuildAccess()) return <>{children}</>;

  async function paste() {
    try {
      const t = await navigator.clipboard.readText();
      setToken(t.trim());
    } catch {
      toast.error("Clipboard unavailable");
    }
  }

  async function submit() {
    if (!token.trim()) return toast.error("Enter your token");
    setBusy(true);
    try {
      await redeemFn({ data: { token: token.trim() } });
      grantBuildAccess();
      toast.success("Access granted");
      setTick((t) => t + 1);
    } catch (e: any) {
      toast.error(e?.message || "Invalid token");
    } finally {
      setBusy(false);
    }
  }

  async function sendRequest() {
    setBusy(true);
    try {
      await requestFn({ data: { reason: reason.trim() || undefined } });
      toast.success("Request sent to administrators");
      setReason("");
      refetch();
    } catch (e: any) {
      toast.error(e?.message || "Failed to send");
    } finally {
      setBusy(false);
    }
  }

  // re-render to re-check hasBuildAccess after grant
  void tick;

  return (
    <div className="min-h-[80vh] grid place-items-center px-4 py-10 relative overflow-hidden">
      {/* floating particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-primary/40 blur-[1px] animate-pulse-glow"
            style={{
              width: 4 + (i % 4) * 2,
              height: 4 + (i % 4) * 2,
              left: `${(i * 53) % 100}%`,
              top: `${(i * 37) % 100}%`,
              animationDelay: `${(i % 6) * 0.4}s`,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-md">
        <div className="absolute -inset-[2px] rounded-2xl bg-gradient-to-r from-primary via-secondary to-primary opacity-70 blur-md animate-pulse-glow" />
        <div className="relative glass-card rounded-2xl p-8 border border-primary/40">
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full p-3 bg-primary/10 neon-border">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
          </div>
          <p className="text-center text-xs font-mono tracking-[0.3em] text-secondary mb-1">
            // BUILD MODE
          </p>
          <h2 className="text-center text-2xl font-display font-bold neon-text mb-2">
            Access Required
          </h2>
          <p className="text-center text-sm text-muted-foreground mb-6">
            Enter your one-time Build Mode access token
          </p>

          {!showRequest ? (
            <>
              <div className="relative mb-3">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                <Input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="GMT#••••••••••••••••"
                  className="pl-9 pr-20 font-mono tracking-wider"
                />
                <button
                  type="button"
                  onClick={paste}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs flex items-center gap-1 text-secondary hover:text-primary transition"
                >
                  <Clipboard className="h-3.5 w-3.5" /> Paste
                </button>
              </div>
              <Button
                onClick={submit}
                disabled={busy}
                className="w-full glow-purple gap-2 mb-4"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Continue
              </Button>
              <button
                onClick={() => setShowRequest(true)}
                className="block w-full text-center text-xs text-muted-foreground hover:text-primary transition"
              >
                Don't have a token? <span className="underline">Request one</span>
              </button>
            </>
          ) : (
            <>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Tell admins why you need Build Mode access (optional)"
                rows={3}
                className="mb-3"
              />
              <Button onClick={sendRequest} disabled={busy} className="w-full gap-2 mb-3">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send Request
              </Button>
              {myRequests.length > 0 && (
                <div className="mb-3 space-y-1.5 max-h-32 overflow-y-auto">
                  {myRequests.map((r: any) => (
                    <div
                      key={r.id}
                      className="text-xs flex items-center justify-between glass rounded px-2 py-1.5"
                    >
                      <span className="text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                      <span
                        className={
                          r.status === "approved"
                            ? "text-green-400"
                            : r.status === "denied"
                              ? "text-destructive"
                              : "text-secondary"
                        }
                      >
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowRequest(false)}
                className="block w-full text-center text-xs text-muted-foreground hover:text-primary transition"
              >
                ← Back to token entry
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

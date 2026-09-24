import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Download, History, Inbox, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { listMyDownloads } from "@/lib/downloader/downloader.functions";

export const Route = createFileRoute("/_authenticated/account/")({
  head: () => ({
    meta: [
      { title: "My Account — Ghost Mods Tech" },
      { name: "description", content: "Manage your Ghost Mods Tech profile, security and downloads." },
      { property: "og:title", content: "My Account — Ghost Mods Tech" },
      { property: "og:description", content: "Manage your profile, security and downloads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const listFn = useServerFn(listMyDownloads);
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: async () => (await supabase.auth.getUser()).data.user });
  const { data: dl } = useQuery({ queryKey: ["dl-history", "all"], queryFn: () => listFn({ data: { status: "all", limit: 50 } }) });
  const [sending, setSending] = useState(false);

  async function resetPassword() {
    if (!user?.email) return;
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/reset-password` });
    setSending(false);
    error ? toast.error(error.message) : toast.success("Password reset email sent.");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12 space-y-6">
      <div><p className="text-xs font-mono tracking-[0.3em] text-primary">// ACCOUNT</p><h1 className="text-3xl font-bold mt-1">My account</h1></div>
      <div className="glass-card rounded-2xl p-6">
        <p className="text-sm text-muted-foreground">Signed in as</p>
        <p className="font-semibold break-all">{user?.email ?? "…"}</p>
        {user?.created_at && <p className="text-xs text-muted-foreground mt-1">Member since {new Date(user.created_at).toLocaleDateString()}</p>}
        <Button variant="outline" size="sm" className="mt-4" onClick={resetPassword} disabled={sending}><KeyRound className="h-4 w-4" /> Send password reset email</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[["Total downloads", dl?.stats.total], ["Completed", dl?.stats.completed], ["In progress", dl?.stats.active]].map(([l, v]) => (
          <div key={l as string} className="glass-card rounded-xl p-5"><p className="text-xs text-muted-foreground">{l}</p><p className="text-2xl font-bold">{v ?? "—"}</p></div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild><Link to="/downloader"><Download className="h-4 w-4" /> Downloader</Link></Button>
        <Button asChild variant="outline"><Link to="/downloader/history"><History className="h-4 w-4" /> History</Link></Button>
        <Button asChild variant="outline"><Link to="/account/requests"><Inbox className="h-4 w-4" /> My requests</Link></Button>
      </div>
    </div>
  );
}

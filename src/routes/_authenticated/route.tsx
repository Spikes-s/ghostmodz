import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/ghost/Navbar";
import { Footer } from "@/components/ghost/Footer";
import { CyberBackground } from "@/components/ghost/CyberBackground";
import { useInactivityLogout } from "@/lib/inactivity";
import { recordLogin } from "@/lib/admin.functions";
import { toast } from "sonner";
import { CommandPalette } from "@/components/ghost/CommandPalette";
import { QuickActions } from "@/components/ghost/QuickActions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    // Check suspension
    const { data: profile } = await supabase
      .from("profiles")
      .select("suspended")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile?.suspended) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const navigate = useNavigate();
  const handleTimeout = useCallback(async () => {
    await supabase.auth.signOut();
    toast.info("Signed out after 20 minutes of inactivity.");
    navigate({ to: "/auth", replace: true });
  }, [navigate]);
  useInactivityLogout(handleTimeout);

  useEffect(() => {
    // Record login once per session mount
    const key = "ghost-login-recorded";
    if (typeof window !== "undefined" && !sessionStorage.getItem(key)) {
      recordLogin().then(() => sessionStorage.setItem(key, "1")).catch(() => {});
    }
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col">
      <CyberBackground />
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CommandPalette />
      <QuickActions />
    </div>
  );
}

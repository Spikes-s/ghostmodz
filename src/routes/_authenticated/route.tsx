import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/ghost/Navbar";
import { Footer } from "@/components/ghost/Footer";
import { CyberBackground } from "@/components/ghost/CyberBackground";
import { useInactivityLogout } from "@/lib/inactivity";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
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

  return (
    <div className="relative min-h-screen flex flex-col">
      <CyberBackground />
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

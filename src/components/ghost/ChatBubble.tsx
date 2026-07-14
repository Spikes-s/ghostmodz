import { Link, useRouterState } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function ChatBubble() {
  const { location } = useRouterState();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setSignedIn(!!session?.user),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // Hide on auth pages and on the support page itself
  const hide =
    location.pathname.startsWith("/auth") ||
    location.pathname.startsWith("/reset-password") ||
    location.pathname.startsWith("/support") ||
    location.pathname.startsWith("/admin/support");
  if (hide) return null;

  const to = signedIn ? "/support" : "/auth";

  return (
    <Link
      to={to}
      aria-label="Open messages"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-1 ring-primary/40 transition-transform hover:scale-110 glow-purple animate-fade-in"
    >
      <MessageCircle className="h-6 w-6" />
      <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-background animate-pulse" />
    </Link>
  );
}

import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Menu, X, LogIn, LayoutDashboard, LogOut } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/services", label: "Services" },
  { to: "/", label: "Enquire", hash: "enquire" },
] as const;

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: session } = useQuery({
    queryKey: ["public-header-session"],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
  });

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        qc.invalidateQueries({ queryKey: ["public-header-session"] });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [qc]);

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const signedIn = Boolean(session);

  return (
    <header className="sticky top-0 z-50 glass border-b border-border/40">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link to="/" className="shrink-0">
          <Logo />
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground rounded-md"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-2">
          {signedIn ? (
            <>
              <Button asChild size="sm" className="glow-purple gap-2">
                <Link to="/dashboard">
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </Link>
              </Button>
              <Button size="sm" variant="ghost" className="gap-2" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </>
          ) : (
            <Button asChild size="sm" className="glow-purple gap-2">
              <Link to="/auth">
                <LogIn className="h-4 w-4" /> Sign in
              </Link>
            </Button>
          )}
        </div>

        <div className="lg:hidden flex items-center gap-1">
          {signedIn && (
            <Button asChild size="sm" variant="ghost" className="gap-2">
              <Link to="/dashboard">
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </Link>
            </Button>
          )}
          <button
            className="glass p-2 rounded-md"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden glass border-t border-border/40 px-6 py-4 space-y-1 animate-fade-up">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md"
            >
              {l.label}
            </Link>
          ))}
          {signedIn ? (
            <button
              onClick={() => {
                setOpen(false);
                handleSignOut();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          ) : (
            <Link
              to="/auth"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary rounded-md"
            >
              <LogIn className="h-4 w-4" /> Sign in
            </Link>
          )}
        </div>
      )}
    </header>
  );
}

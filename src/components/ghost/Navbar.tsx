import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, LogOut, Shield } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/use-is-admin";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/spikes", label: "Spikes Bot" },
  { href: "/build", label: "Build Mode" },
  { href: "/#services", label: "Services" },
  { href: "/#contact", label: "Contact" },
] as const;

export function Navbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-50 glass border-b border-border/40">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link to="/" className="shrink-0">
          <Logo />
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground rounded-md"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-2">
          {isAdmin && (
            <Link to="/admin" className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-primary hover:text-primary/80 neon-border rounded-md">
              <Shield className="h-4 w-4" /> Admin
            </Link>
          )}
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-2">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>

        <button
          className="lg:hidden glass p-2 rounded-md"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden glass border-t border-border/40 px-6 py-4 space-y-1 animate-fade-up">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md"
            >
              {item.label}
            </a>
          ))}
          {isAdmin && (
            <Link to="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary rounded-md">
              <Shield className="h-4 w-4" /> Admin Console
            </Link>
          )}
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start gap-2 mt-2">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      )}
    </header>
  );
}

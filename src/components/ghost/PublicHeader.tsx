import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X, LogIn } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/services", label: "Services" },
  { to: "/", hash: "enquire", label: "Enquire" },
] as const;

export function PublicHeader() {
  const [open, setOpen] = useState(false);

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
              hash={"hash" in l ? (l.hash as string) : undefined}
              className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground rounded-md"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-2">
          <Button asChild size="sm" className="glow-purple gap-2">
            <Link to="/auth">
              <LogIn className="h-4 w-4" /> Sign in
            </Link>
          </Button>
        </div>

        <div className="lg:hidden flex items-center gap-1">
          <Button asChild size="sm" variant="ghost" className="gap-2">
            <Link to="/auth">
              <LogIn className="h-4 w-4" /> Sign in
            </Link>
          </Button>
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
              hash={"hash" in l ? (l.hash as string) : undefined}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md"
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
